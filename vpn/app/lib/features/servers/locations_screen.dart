import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/design/components/brand.dart';
import '../../core/design/components/buttons.dart';
import '../../core/design/components/elements.dart';
import '../../core/design/components/glass.dart';
import '../../core/design/components/page.dart';
import '../../core/design/components/pressable.dart';
import '../../core/design/tokens.dart';
import '../../core/design/typography.dart';
import '../account/account.dart';
import '../vpn/application/vpn_controller.dart';
import '../vpn/domain/vpn_models.dart';
import 'application/server_providers.dart';
import 'domain/server.dart';
import 'widgets/server_visuals.dart';

enum _Filter { all, favorites, free, premium }

/// Selects [server] and, if a tunnel is active, moves it there.
Future<void> chooseServer(BuildContext context, WidgetRef ref, VpnServer server) async {
  final premium = ref.read(isPremiumProvider);
  if (server.isPremium && !premium) {
    context.push('/premium');
    return;
  }
  ref.read(selectedServerIdProvider.notifier).select(server.id);
  final vpn = ref.read(vpnControllerProvider.notifier);
  final phase = ref.read(vpnControllerProvider).phase;
  context.go('/home');
  if (phase == VpnPhase.connected || phase == VpnPhase.reconnecting) {
    await vpn.disconnect();
    await vpn.connect(server);
  }
}

class LocationsScreen extends ConsumerStatefulWidget {
  const LocationsScreen({super.key});

  @override
  ConsumerState<LocationsScreen> createState() => _LocationsScreenState();
}

class _LocationsScreenState extends ConsumerState<LocationsScreen> {
  final _search = TextEditingController();
  _Filter _filter = _Filter.all;
  String _query = '';

  @override
  void initState() {
    super.initState();
    // Measure once the list is available; results stream in as they land.
    WidgetsBinding.instance.addPostFrameCallback((_) => _measureWhenReady());
  }

  Future<void> _measureWhenReady() async {
    try {
      await ref.read(serversProvider.future);
      if (mounted) await ref.read(latencyProvider.notifier).measureAll();
    } on Object {
      // The list itself shows the error state.
    }
  }

  Future<void> _refresh() async {
    ref.invalidate(serversProvider);
    await _measureWhenReady();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final servers = ref.watch(serversProvider);
    final favorites = ref.watch(favoritesProvider);
    final premium = ref.watch(isPremiumProvider);
    final selectedId = ref.watch(selectedServerIdProvider);
    final fastest = ref.watch(fastestServerProvider(premium));

    List<VpnServer> visible(List<VpnServer> all) {
      final q = _query.trim().toLowerCase();
      return all.where((s) {
        final matches = q.isEmpty ||
            s.city.toLowerCase().contains(q) ||
            s.countryName.toLowerCase().contains(q) ||
            s.countryCode.toLowerCase() == q ||
            s.name.toLowerCase().contains(q);
        final passes = switch (_filter) {
          _Filter.all => true,
          _Filter.favorites => favorites.contains(s.id),
          _Filter.free => !s.isPremium,
          _Filter.premium => s.isPremium,
        };
        return matches && passes;
      }).toList();
    }

    return RefreshIndicator(
      onRefresh: _refresh,
      color: OColors.ice,
      backgroundColor: OColors.bgRaised,
      edgeOffset: MediaQuery.paddingOf(context).top + 56,
      child: OPage(
        title: 'Locations',
        subtitle: 'Latency is measured from this device',
        standalone: false,
        slivers: [
          SliverToBoxAdapter(child: _SearchField(controller: _search, onChanged: (v) => setState(() => _query = v))),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: OSpace.sm),
              child: _FilterBar(value: _filter, onChanged: (f) => setState(() => _filter = f)),
            ),
          ),
          ...switch (servers) {
            AsyncData(:final value) when value.isEmpty => [
                const SliverToBoxAdapter(
                  child: OEmptyState(
                    icon: Icons.dns_rounded,
                    title: 'No locations published',
                    message: 'The service is reachable but has no servers listed yet.',
                  ),
                ),
              ],
            AsyncData(:final value) => [
                if (fastest != null && _query.isEmpty && _filter == _Filter.all) ...[
                  const SliverToBoxAdapter(child: SectionLabel('Recommended')),
                  SliverToBoxAdapter(child: _FastestCard(server: fastest, onTap: () => chooseServer(context, ref, fastest))),
                ],
                SliverToBoxAdapter(child: SectionLabel(_filter == _Filter.favorites ? 'Favorites' : 'All locations')),
                _ServerList(servers: visible(value), selectedId: selectedId, favorites: favorites, premium: premium),
              ],
            AsyncError(:final error) => [
                SliverToBoxAdapter(
                  child: OEmptyState(
                    icon: Icons.cloud_off_rounded,
                    title: 'Locations unavailable',
                    message: error is ServersUnavailable && error.reason == 'not_configured'
                        ? 'This build has no Orvane service address (ORVANE_API_URL), so there is no server list to show.'
                        : 'We couldn’t reach the server list. Check your connection and try again.',
                    action: error is ServersUnavailable && error.reason == 'not_configured'
                        ? null
                        : OButton(label: 'Try again', onPressed: _refresh, variant: OButtonVariant.secondary, expand: false),
                  ),
                ),
              ],
            _ => [
                const SliverToBoxAdapter(
                  child: Padding(padding: EdgeInsets.all(OSpace.xxxl), child: Center(child: OSpinner(size: 28))),
                ),
              ],
          },
        ],
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      style: OType.body,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: 'Search country or city',
        prefixIcon: const Icon(Icons.search_rounded, color: OColors.textMuted),
        suffixIcon: ValueListenableBuilder(
          valueListenable: controller,
          builder: (context, v, _) => v.text.isEmpty
              ? const SizedBox.shrink()
              : IconButton(
                  tooltip: 'Clear search',
                  icon: const Icon(Icons.close_rounded, color: OColors.textMuted, size: 20),
                  onPressed: () {
                    controller.clear();
                    onChanged('');
                  },
                ),
        ),
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.value, required this.onChanged});

  final _Filter value;
  final ValueChanged<_Filter> onChanged;

  @override
  Widget build(BuildContext context) {
    const labels = {_Filter.all: 'All', _Filter.favorites: 'Favorites', _Filter.free: 'Free', _Filter.premium: 'Premium'};
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          for (final f in _Filter.values)
            Padding(
              padding: const EdgeInsets.only(right: OSpace.xs),
              child: Pressable(
                onTap: () => onChanged(f),
                selected: f == value,
                semanticLabel: 'Show ${labels[f]} locations',
                child: AnimatedContainer(
                  duration: OMotion.standard,
                  curve: OMotion.enter,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    borderRadius: ORadius.chip,
                    color: f == value ? OColors.blue.withValues(alpha: 0.2) : OColors.glassFill,
                    border: Border.all(color: f == value ? OColors.blue.withValues(alpha: 0.5) : OColors.glassStroke),
                  ),
                  child: Text(labels[f]!, style: OType.caption.copyWith(color: f == value ? OColors.text : OColors.textMuted, fontSize: 13)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _FastestCard extends ConsumerWidget {
  const _FastestCard({required this.server, required this.onTap});

  final VpnServer server;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final latency = ref.watch(latencyProvider)[server.id];
    return Pressable(
      onTap: onTap,
      pressedScale: 0.98,
      semanticLabel: 'Fastest measured location: ${server.city}, ${server.countryName}',
      child: GlassSurface(
        tint: OColors.blue,
        elevation: OElevation.high,
        child: Row(
          children: [
            ServerFlag(server: server, size: 48),
            const SizedBox(width: OSpace.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.bolt_rounded, size: 15, color: OColors.ice),
                      const SizedBox(width: 4),
                      Text('Fastest from here', style: OType.caption.copyWith(color: OColors.ice)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('${server.city}, ${server.countryName}', style: OType.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            LatencyLabel(latency: latency, measured: true),
          ],
        ),
      ),
    );
  }
}

class _ServerList extends StatelessWidget {
  const _ServerList({required this.servers, required this.selectedId, required this.favorites, required this.premium});

  final List<VpnServer> servers;
  final String? selectedId;
  final Set<String> favorites;
  final bool premium;

  @override
  Widget build(BuildContext context) {
    if (servers.isEmpty) {
      return const SliverToBoxAdapter(
        child: OEmptyState(icon: Icons.search_off_rounded, title: 'No matches', message: 'Try another country, city or filter.'),
      );
    }
    return SliverList.separated(
      itemCount: servers.length,
      separatorBuilder: (_, _) => const SizedBox(height: OSpace.xs),
      itemBuilder: (context, i) => Reveal(
        delay: Duration(milliseconds: 25 * i.clamp(0, 12)),
        offset: 10,
        child: ServerRow(
          server: servers[i],
          selected: servers[i].id == selectedId,
          favorite: favorites.contains(servers[i].id),
          locked: servers[i].isPremium && !premium,
        ),
      ),
    );
  }
}

class ServerRow extends ConsumerWidget {
  const ServerRow({super.key, required this.server, required this.selected, required this.favorite, required this.locked});

  final VpnServer server;
  final bool selected;
  final bool favorite;
  final bool locked;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final latencies = ref.watch(latencyProvider);
    final available = server.isOnline;
    return Pressable(
      onTap: available ? () => chooseServer(context, ref, server) : null,
      pressedScale: 0.98,
      selected: selected,
      semanticLabel: '${server.city}, ${server.countryName}${server.isPremium ? ', premium' : ''}${available ? '' : ', unavailable'}',
      semanticHint: locked ? 'Requires Premium' : 'Select location',
      child: Opacity(
        opacity: available ? 1 : 0.5,
        child: GlassSurface(
          tint: selected ? OColors.blue : null,
          elevation: OElevation.low,
          padding: const EdgeInsets.fromLTRB(OSpace.md, 12, 6, 12),
          child: Row(
            children: [
              ServerFlag(server: server, size: 40),
              const SizedBox(width: OSpace.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(server.city, style: OType.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            available
                                ? server.countryName
                                : '${server.countryName} · ${server.availability == ServerAvailability.maintenance ? 'Maintenance' : 'Offline'}',
                            style: OType.footnote,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (server.isPremium) ...[const SizedBox(width: 6), const PremiumBadge()],
                      ],
                    ),
                  ],
                ),
              ),
              if (locked)
                const Padding(
                  padding: EdgeInsets.only(right: 6),
                  child: Icon(Icons.lock_rounded, size: 16, color: OColors.textFaint),
                )
              else if (available)
                LatencyLabel(latency: latencies[server.id], measured: latencies.containsKey(server.id)),
              IconButton(
                visualDensity: VisualDensity.compact,
                tooltip: favorite ? 'Remove from favorites' : 'Add to favorites',
                onPressed: () => ref.read(favoritesProvider.notifier).toggle(server.id),
                icon: AnimatedSwitcher(
                  duration: OMotion.quick,
                  transitionBuilder: (c, a) => ScaleTransition(scale: a, child: c),
                  child: Icon(
                    favorite ? Icons.star_rounded : Icons.star_outline_rounded,
                    key: ValueKey(favorite),
                    color: favorite ? OColors.warning : OColors.textFaint,
                    size: 22,
                  ),
                ),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                tooltip: 'Location details',
                onPressed: () => context.push('/locations/${server.id}'),
                icon: const Icon(Icons.info_outline_rounded, color: OColors.textMuted, size: 20),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
