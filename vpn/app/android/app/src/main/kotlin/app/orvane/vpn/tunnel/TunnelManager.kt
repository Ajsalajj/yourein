package app.orvane.vpn.tunnel

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.SystemClock
import android.util.Log
import com.wireguard.android.backend.BackendException
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/** Events the Flutter side subscribes to. */
sealed interface TunnelEvent {
    data class State(val up: Boolean, val serverId: String?, val reason: String?) : TunnelEvent
    data class NetworkChanged(val available: Boolean, val type: String?) : TunnelEvent
}

class TunnelStartException(val code: String, cause: Throwable? = null) : Exception(code, cause)

/**
 * Process-wide owner of the WireGuard tunnel.
 *
 * Lives as long as the app process, which Android keeps alive while the VPN
 * service is bound, so the tunnel survives the UI being closed. All backend
 * calls run on one background thread, because bringing a tunnel up blocks
 * (DNS resolution of the endpoint, interface creation).
 *
 * Logs contain state names only - never keys, endpoints or configs.
 */
object TunnelManager {
    private const val TAG = "Orvane/Tunnel"
    private const val PREFS = "orvane.tunnel"
    private const val PREF_LAST_SPEC = "last_spec"
    private const val PREF_WANT_UP = "want_up"

    /** WireGuard rekeys every 2 minutes on a live session; 3 minutes means trouble. */
    private const val STALE_MS = 180_000L
    private const val REAPPLY_MIN_INTERVAL_MS = 120_000L
    private const val WATCHDOG_SECONDS = 30L

    private lateinit var appContext: Context
    private lateinit var vault: KeyVault
    private val backend by lazy { GoBackend(appContext) }
    private val worker = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "orvane-tunnel") }
    private val listeners = CopyOnWriteArraySet<(TunnelEvent) -> Unit>()

    @Volatile private var spec: TunnelSpec? = null
    @Volatile private var stopping = false
    @Volatile private var reapplying = false
    @Volatile private var networkAvailable = true
    @Volatile private var networkType: String? = null
    private var watchdog: ScheduledFuture<*>? = null
    private var lastReapplyAt = 0L

    private val tunnel = object : Tunnel {
        override fun getName() = "orvane"

        override fun onStateChange(newState: Tunnel.State) {
            val up = newState == Tunnel.State.UP
            Log.i(TAG, "tunnel $newState")
            if (!up && reapplying) return // internal DOWN->UP while re-establishing
            if (!up) {
                // DOWN that we didn't ask for = the system revoked the VPN
                // (another VPN app started, or the user turned it off).
                val reason = if (stopping) "user" else "revoked"
                if (!stopping) prefs().edit().putBoolean(PREF_WANT_UP, false).apply()
                stopWatchdog()
                emit(TunnelEvent.State(false, spec?.serverId, reason))
            } else {
                emit(TunnelEvent.State(true, spec?.serverId, null))
            }
        }
    }

    fun init(context: Context) {
        if (::appContext.isInitialized) return
        appContext = context.applicationContext
        vault = KeyVault(appContext)
        GoBackend.setAlwaysOnCallback { worker.execute { startLastKnown() } }
        monitorNetwork()
    }

    fun addListener(l: (TunnelEvent) -> Unit) = listeners.add(l)
    fun removeListener(l: (TunnelEvent) -> Unit) = listeners.remove(l)
    private fun emit(e: TunnelEvent) = listeners.forEach { it(e) }

    private fun prefs() = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun publicKey(): String = vault.publicKeyBase64()

    /** Must not be called while a tunnel is up: the server peer would no longer match. */
    fun rotateKey(): String {
        if (isUp()) stop()
        return vault.rotate().publicKey.toBase64()
    }

    fun isUp(): Boolean = backend.getState(tunnel) == Tunnel.State.UP

    /** Brings the tunnel up with [next]. Blocking; call off the main thread. */
    @Synchronized
    fun start(next: TunnelSpec) = start(next, reapply = false)

    @Synchronized
    private fun start(next: TunnelSpec, reapply: Boolean) {
        val config = try {
            next.toConfig(vault.keyPair())
        } catch (e: Exception) {
            throw TunnelStartException("BAD_CONFIG", e)
        }
        try {
            stopping = false
            reapplying = reapply
            spec = next
            backend.setState(tunnel, Tunnel.State.UP, config)
        } catch (e: BackendException) {
            if (!reapply) spec = null
            throw TunnelStartException(
                when (e.reason) {
                    BackendException.Reason.VPN_NOT_AUTHORIZED -> "PERMISSION_DENIED"
                    BackendException.Reason.DNS_RESOLUTION_FAILURE -> "ENDPOINT_DNS"
                    BackendException.Reason.UNABLE_TO_START_VPN -> "SERVICE_START"
                    BackendException.Reason.TUN_CREATION_ERROR -> "TUN_CREATE"
                    else -> "BACKEND_FAILED"
                },
                e,
            )
        } catch (e: Exception) {
            if (!reapply) spec = null
            throw TunnelStartException("BACKEND_FAILED", e)
        } finally {
            reapplying = false
        }
        prefs().edit().putString(PREF_LAST_SPEC, next.toJson()).putBoolean(PREF_WANT_UP, true).apply()
        lastReapplyAt = SystemClock.elapsedRealtime()
        startWatchdog()
    }

    @Synchronized
    fun stop() {
        prefs().edit().putBoolean(PREF_WANT_UP, false).apply()
        stopWatchdog()
        if (!isUp()) return
        stopping = true
        try {
            backend.setState(tunnel, Tunnel.State.DOWN, null)
        } finally {
            stopping = false
        }
    }

    data class Status(val up: Boolean, val serverId: String?, val rx: Long, val tx: Long, val lastHandshakeMs: Long)

    fun status(): Status {
        if (!isUp()) return Status(false, null, 0, 0, 0)
        val s = spec ?: return Status(true, null, 0, 0, 0)
        val stats = backend.getStatistics(tunnel)
        val peer = runCatching { stats.peer(com.wireguard.crypto.Key.fromBase64(s.serverPublicKey)) }.getOrNull()
        return Status(true, s.serverId, peer?.rxBytes ?: 0, peer?.txBytes ?: 0, peer?.latestHandshakeEpochMillis ?: 0)
    }

    fun diagnostics(): Map<String, Any?> = mapOf(
        "engine" to "wireguard-go",
        "wireguardVersion" to runCatching { backend.version }.getOrNull(),
        "tunnelUp" to isUp(),
        "networkAvailable" to networkAvailable,
        "networkType" to networkType,
        "alwaysOn" to runCatching { isUp() && backend.isAlwaysOn }.getOrNull(),
        "lockdown" to runCatching { isUp() && backend.isLockdownEnabled }.getOrNull(),
    )

    /** Called when Android's always-on VPN starts our service (e.g. at boot). */
    private fun startLastKnown() {
        val json = prefs().getString(PREF_LAST_SPEC, null)
        if (json == null) {
            Log.w(TAG, "always-on start without a saved configuration")
            return
        }
        try {
            start(TunnelSpec.fromJson(json))
        } catch (e: Exception) {
            Log.w(TAG, "always-on start failed: ${(e as? TunnelStartException)?.code ?: e.javaClass.simpleName}")
        }
    }

    private fun startWatchdog() {
        stopWatchdog()
        watchdog = worker.scheduleWithFixedDelay(::checkHealth, WATCHDOG_SECONDS, WATCHDOG_SECONDS, TimeUnit.SECONDS)
    }

    private fun stopWatchdog() {
        watchdog?.cancel(false)
        watchdog = null
    }

    /**
     * Auto-reconnect. WireGuard roams between networks by itself; what it
     * can't do is re-resolve a server hostname or recover a stuck socket. If
     * no handshake has completed for [STALE_MS] while the device has a
     * network, the interface is rebuilt from the same spec (rate-limited).
     */
    private fun checkHealth() {
        val s = spec ?: return
        if (!isUp() || !networkAvailable) return
        val st = status()
        val now = System.currentTimeMillis()
        val stale = st.lastHandshakeMs == 0L || now - st.lastHandshakeMs > STALE_MS
        val sinceReapply = SystemClock.elapsedRealtime() - lastReapplyAt
        if (stale && sinceReapply > REAPPLY_MIN_INTERVAL_MS) {
            Log.i(TAG, "handshake stale; re-establishing")
            runCatching { start(s, reapply = true) }.onFailure { Log.w(TAG, "re-establish failed") }
        }
    }

    /**
     * Watches the *underlying* networks. This app's own traffic is routed
     * into the tunnel, so its default network is the VPN itself; asking for
     * NOT_VPN networks reports the real Wi-Fi / mobile state instead.
     */
    private fun monitorNetwork() {
        val cm = appContext.getSystemService(ConnectivityManager::class.java) ?: return
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
            .build()
        val live = ConcurrentHashMap<Network, String>()
        fun publish() {
            val available = live.isNotEmpty()
            val changed = available != networkAvailable
            networkAvailable = available
            networkType = live.values.firstOrNull { it == "wifi" } ?: live.values.firstOrNull()
            if (changed) emit(TunnelEvent.NetworkChanged(available, networkType))
        }
        cm.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                val isNew = !live.containsKey(network)
                live[network] = when {
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
                    else -> "other"
                }
                publish()
                // A new network is when a stuck tunnel most likely recovers;
                // check soon rather than waiting for the timer.
                if (isNew) worker.schedule(::checkHealth, 5, TimeUnit.SECONDS)
            }

            override fun onLost(network: Network) {
                live.remove(network)
                publish()
            }
        })
    }

    fun runOnWorker(block: () -> Unit) = worker.execute(block)
}
