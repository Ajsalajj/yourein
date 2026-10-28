package app.orvane.vpn.tunnel

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.PluginRegistry

/**
 * Platform-channel bridge between Dart's MethodChannelVpnEngine and
 * [TunnelManager]. The private key never crosses this boundary: Dart only
 * ever receives the public key.
 */
class VpnChannel : FlutterPlugin, ActivityAware, MethodChannel.MethodCallHandler, EventChannel.StreamHandler,
    PluginRegistry.ActivityResultListener {

    private lateinit var methods: MethodChannel
    private lateinit var events: EventChannel
    private var sink: EventChannel.EventSink? = null
    private var activity: ActivityPluginBinding? = null
    private var pendingPrepare: MethodChannel.Result? = null
    private val main = Handler(Looper.getMainLooper())

    private val listener: (TunnelEvent) -> Unit = { e ->
        val payload = when (e) {
            is TunnelEvent.State -> mapOf("type" to "tunnel", "up" to e.up, "serverId" to e.serverId, "reason" to e.reason)
            is TunnelEvent.NetworkChanged -> mapOf("type" to "network", "available" to e.available, "networkType" to e.type)
        }
        main.post { sink?.success(payload) }
    }

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        TunnelManager.init(binding.applicationContext)
        methods = MethodChannel(binding.binaryMessenger, "app.orvane.vpn/engine").also { it.setMethodCallHandler(this) }
        events = EventChannel(binding.binaryMessenger, "app.orvane.vpn/events").also { it.setStreamHandler(this) }
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        methods.setMethodCallHandler(null)
        events.setStreamHandler(null)
        TunnelManager.removeListener(listener)
    }

    override fun onListen(arguments: Any?, events: EventChannel.EventSink) {
        sink = events
        TunnelManager.addListener(listener)
    }

    override fun onCancel(arguments: Any?) {
        TunnelManager.removeListener(listener)
        sink = null
    }

    /** Runs [block] on the tunnel thread and replies on the main thread. */
    private fun async(result: MethodChannel.Result, block: () -> Any?) {
        TunnelManager.runOnWorker {
            try {
                val value = block()
                main.post { result.success(value) }
            } catch (e: TunnelStartException) {
                main.post { result.error(e.code, null, null) }
            } catch (e: IllegalArgumentException) {
                main.post { result.error("BAD_CONFIG", e.message, null) }
            } catch (e: Exception) {
                main.post { result.error("ENGINE_ERROR", e.javaClass.simpleName, null) }
            }
        }
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "prepare" -> prepare(result)
            "publicKey" -> async(result) { TunnelManager.publicKey() }
            "rotateKey" -> async(result) { TunnelManager.rotateKey() }
            "start" -> {
                val spec = try {
                    TunnelSpec.fromChannel(call.arguments)
                } catch (e: Exception) {
                    result.error("BAD_CONFIG", e.message, null)
                    return
                }
                async(result) { TunnelManager.start(spec); null }
            }
            "stop" -> async(result) { TunnelManager.stop(); null }
            "status" -> async(result) {
                val s = TunnelManager.status()
                mapOf("up" to s.up, "serverId" to s.serverId, "rxBytes" to s.rx, "txBytes" to s.tx, "lastHandshakeMs" to s.lastHandshakeMs)
            }
            "diagnostics" -> async(result) {
                TunnelManager.diagnostics() + mapOf(
                    "androidSdk" to Build.VERSION.SDK_INT,
                    "appVersion" to runCatching {
                        val ctx = activity?.activity ?: return@runCatching null
                        ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName
                    }.getOrNull(),
                )
            }
            "openVpnSettings" -> {
                val a = activity?.activity
                if (a == null) {
                    result.error("NO_ACTIVITY", null, null)
                } else {
                    a.startActivity(Intent(Settings.ACTION_VPN_SETTINGS))
                    result.success(null)
                }
            }
            else -> result.notImplemented()
        }
    }

    /** Shows Android's VPN consent dialog if this app isn't approved yet. */
    private fun prepare(result: MethodChannel.Result) {
        val a = activity?.activity ?: return result.error("NO_ACTIVITY", null, null)
        val intent = VpnService.prepare(a) ?: return result.success(true)
        if (pendingPrepare != null) return result.error("BUSY", null, null)
        pendingPrepare = result
        a.startActivityForResult(intent, REQUEST_PREPARE)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != REQUEST_PREPARE) return false
        pendingPrepare?.success(resultCode == Activity.RESULT_OK)
        pendingPrepare = null
        return true
    }

    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        activity = binding
        binding.addActivityResultListener(this)
    }

    override fun onDetachedFromActivityForConfigChanges() = onDetachedFromActivity()
    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) = onAttachedToActivity(binding)

    override fun onDetachedFromActivity() {
        activity?.removeActivityResultListener(this)
        activity = null
        pendingPrepare?.success(false)
        pendingPrepare = null
    }

    private companion object {
        const val REQUEST_PREPARE = 0x5650 // "VP"
    }
}
