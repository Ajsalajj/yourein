import '../../../core/net/api_client.dart';
import '../../servers/domain/server.dart';
import '../domain/provisioner.dart';
import '../domain/vpn_models.dart';

/// Requests a WireGuard peer for this device from the Orvane backend.
///
/// The backend registers (or reuses) the device by its public key, checks
/// plan and device limits, allocates tunnel addresses on the chosen gateway,
/// installs the peer there, and returns the parameters needed to build the
/// local interface. Only the public key is ever sent.
class ApiProvisioner implements Provisioner {
  ApiProvisioner(this._api, {required this.deviceName, required this.signedIn});

  final ApiClient _api;
  final String deviceName;
  final bool Function() signedIn;

  @override
  Future<TunnelConfig> provision({required VpnServer server, required String devicePublicKey}) async {
    if (!signedIn()) throw const ProvisionException(VpnErrorKind.notSignedIn);
    try {
      final j = await _api.post('/v1/tunnels', {
        'serverId': server.id,
        'publicKey': devicePublicKey,
        'deviceName': deviceName,
        'platform': 'android',
      }) as Map<String, dynamic>;
      return TunnelConfig.fromJson(j);
    } on ApiException catch (e) {
      throw ProvisionException(switch (e.code) {
        'unauthorized' => VpnErrorKind.notSignedIn,
        'device_limit' => VpnErrorKind.deviceLimit,
        'premium_required' => VpnErrorKind.premiumRequired,
        _ => VpnErrorKind.provisioningFailed,
      }, e.isNetwork ? 'network' : null);
    } on TypeError {
      throw const ProvisionException(VpnErrorKind.provisioningFailed, 'bad response');
    }
  }
}
