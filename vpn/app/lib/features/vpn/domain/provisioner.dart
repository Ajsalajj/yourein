import '../../servers/domain/server.dart';
import 'vpn_models.dart';

/// Thrown by a [Provisioner] with the user-facing reason it failed.
class ProvisionException implements Exception {
  const ProvisionException(this.kind, [this.detail]);
  final VpnErrorKind kind;
  final String? detail;
}

/// Obtains tunnel parameters for this device on [server] from the backend.
abstract interface class Provisioner {
  Future<TunnelConfig> provision({required VpnServer server, required String devicePublicKey});
}

class NotConfiguredProvisioner implements Provisioner {
  const NotConfiguredProvisioner();
  @override
  Future<TunnelConfig> provision({required VpnServer server, required String devicePublicKey}) =>
      throw const ProvisionException(VpnErrorKind.notConfigured);
}
