package app.orvane.vpn.tunnel

import com.wireguard.config.Config
import com.wireguard.config.InetEndpoint
import com.wireguard.config.InetNetwork
import com.wireguard.config.Interface
import com.wireguard.config.Peer
import com.wireguard.crypto.Key
import com.wireguard.crypto.KeyPair
import org.json.JSONArray
import org.json.JSONObject

/**
 * Server-issued tunnel parameters. Contains no private key, so it can be
 * persisted (to restart the tunnel when Android's always-on VPN starts the
 * service at boot) without exposing secrets.
 */
data class TunnelSpec(
    val serverId: String,
    val addresses: List<String>,
    val dns: List<String>,
    val serverPublicKey: String,
    val endpoint: String,
    val allowedIps: List<String>,
    val presharedKey: String?,
    val persistentKeepalive: Int,
    val mtu: Int?,
) {
    /** Builds the WireGuard config, validating every field. */
    fun toConfig(keys: KeyPair, excludedApps: List<String> = emptyList()): Config {
        val iface = Interface.Builder()
            .setKeyPair(keys)
            .apply {
                addresses.forEach { addAddress(InetNetwork.parse(it)) }
                parseDnsServers(dns.joinToString(","))
                mtu?.let { setMtu(it) }
                excludeApplications(excludedApps)
            }
            .build()
        val peer = Peer.Builder()
            .setPublicKey(Key.fromBase64(serverPublicKey))
            .setEndpoint(InetEndpoint.parse(endpoint))
            .setPersistentKeepalive(persistentKeepalive)
            .apply {
                allowedIps.forEach { addAllowedIp(InetNetwork.parse(it)) }
                presharedKey?.let { setPreSharedKey(Key.fromBase64(it)) }
            }
            .build()
        return Config.Builder().setInterface(iface).addPeer(peer).build()
    }

    fun toJson(): String = JSONObject()
        .put("serverId", serverId)
        .put("addresses", JSONArray(addresses))
        .put("dns", JSONArray(dns))
        .put("serverPublicKey", serverPublicKey)
        .put("endpoint", endpoint)
        .put("allowedIps", JSONArray(allowedIps))
        .put("presharedKey", presharedKey ?: JSONObject.NULL)
        .put("persistentKeepalive", persistentKeepalive)
        .put("mtu", mtu ?: JSONObject.NULL)
        .toString()

    companion object {
        /** Parses the platform-channel map; throws IllegalArgumentException on bad input. */
        fun fromChannel(args: Any?): TunnelSpec {
            val m = args as? Map<*, *> ?: throw IllegalArgumentException("config missing")
            fun str(k: String) = m[k] as? String ?: throw IllegalArgumentException("$k missing")
            fun list(k: String) = (m[k] as? List<*>)?.map { it as? String ?: throw IllegalArgumentException("$k item") }
                ?: throw IllegalArgumentException("$k missing")
            val spec = TunnelSpec(
                serverId = str("serverId"),
                addresses = list("addresses"),
                dns = list("dns"),
                serverPublicKey = str("serverPublicKey"),
                endpoint = str("endpoint"),
                allowedIps = list("allowedIps"),
                presharedKey = m["presharedKey"] as? String,
                persistentKeepalive = (m["persistentKeepalive"] as? Number)?.toInt() ?: 25,
                mtu = (m["mtu"] as? Number)?.toInt(),
            )
            spec.validate()
            return spec
        }

        fun fromJson(json: String): TunnelSpec {
            val o = JSONObject(json)
            fun list(k: String) = o.getJSONArray(k).let { a -> List(a.length()) { a.getString(it) } }
            return TunnelSpec(
                serverId = o.getString("serverId"),
                addresses = list("addresses"),
                dns = list("dns"),
                serverPublicKey = o.getString("serverPublicKey"),
                endpoint = o.getString("endpoint"),
                allowedIps = list("allowedIps"),
                presharedKey = if (o.isNull("presharedKey")) null else o.getString("presharedKey"),
                persistentKeepalive = o.optInt("persistentKeepalive", 25),
                mtu = if (o.isNull("mtu")) null else o.getInt("mtu"),
            )
        }
    }

    private fun validate() {
        require(addresses.isNotEmpty()) { "no addresses" }
        require(allowedIps.isNotEmpty()) { "no allowed IPs" }
        require(persistentKeepalive in 0..65535) { "keepalive" }
        require(mtu == null || mtu in 1280..1500) { "mtu" }
        // Parse everything now so errors surface as a clear channel error
        // rather than deep inside the backend.
        toConfig(KeyPair())
    }
}
