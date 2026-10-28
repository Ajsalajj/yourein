import 'package:flutter/material.dart';

import '../../../core/design/tokens.dart';
import '../../../core/design/typography.dart';
import '../../../core/format.dart';
import '../domain/server.dart';

/// Country flag inside a lit glass disc.
class ServerFlag extends StatelessWidget {
  const ServerFlag({super.key, required this.server, this.size = 40});

  final VpnServer server;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: const RadialGradient(
            center: Alignment(-0.4, -0.5),
            colors: [Color(0x26FFFFFF), Color(0x08FFFFFF)],
          ),
          border: Border.all(color: OColors.glassStroke),
        ),
        child: Text(server.flag, style: TextStyle(fontSize: size * 0.5, height: 1.1)),
      ),
    );
  }
}

class PremiumBadge extends StatelessWidget {
  const PremiumBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        gradient: const LinearGradient(colors: [Color(0x404F8CFF), Color(0x2893C5FD)]),
        border: Border.all(color: OColors.blue.withValues(alpha: 0.4)),
      ),
      child: Text('PREMIUM', style: OType.eyebrow.copyWith(color: OColors.ice, fontSize: 9, letterSpacing: 0.9)),
    );
  }
}

/// Measured latency with a three-bar signal glyph.
/// [measured] distinguishes "not probed yet" from "probe failed".
class LatencyLabel extends StatelessWidget {
  const LatencyLabel({super.key, required this.latency, required this.measured});

  final Duration? latency;
  final bool measured;

  @override
  Widget build(BuildContext context) {
    final ms = latency?.inMilliseconds;
    final (bars, color) = switch (ms) {
      null => (0, OColors.textFaint),
      < 80 => (3, OColors.success),
      < 180 => (2, OColors.ice),
      _ => (1, OColors.warning),
    };
    final text = !measured ? '—' : (latency == null ? 'No reply' : Fmt.latency(latency));
    return Semantics(
      label: !measured ? 'Latency not measured' : (latency == null ? 'Server did not reply' : 'Latency ${Fmt.latency(latency)}'),
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < 3; i++)
              Container(
                width: 3,
                height: 5.0 + i * 3,
                margin: const EdgeInsets.only(right: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(1.5),
                  color: i < bars ? color : OColors.glassHighlight,
                ),
              ),
            const SizedBox(width: 4),
            Text(text, style: OType.caption.copyWith(color: measured && latency != null ? OColors.text : OColors.textFaint)),
          ],
        ),
      ),
    );
  }
}
