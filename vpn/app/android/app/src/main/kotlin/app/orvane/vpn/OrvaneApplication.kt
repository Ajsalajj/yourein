package app.orvane.vpn

import android.app.Application
import app.orvane.vpn.tunnel.TunnelManager

class OrvaneApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Registered before any UI exists so Android's always-on VPN can
        // restart the tunnel at boot without the app being opened.
        TunnelManager.init(this)
    }
}
