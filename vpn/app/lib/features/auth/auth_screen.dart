import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/design/components/ambient_background.dart';
import '../../core/design/components/brand.dart';
import '../../core/design/components/buttons.dart';
import '../../core/design/components/elements.dart';
import '../../core/design/components/pressable.dart';
import '../../core/design/tokens.dart';
import '../../core/design/typography.dart';
import '../../core/providers.dart';
import '../account/account.dart';
import 'application/auth_controller.dart';
import 'data/auth_service.dart';

enum _Mode { signIn, signUp }

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key, this.next});

  /// Where to go after signing in (defaults to back).
  final String? next;

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  _Mode _mode = _Mode.signIn;
  bool _obscure = true;
  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _leave() {
    if (widget.next != null) {
      context.go(widget.next!);
    } else if (context.canPop()) {
      context.pop();
    } else {
      context.go('/home');
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });
    final auth = ref.read(authControllerProvider.notifier);
    try {
      if (_mode == _Mode.signIn) {
        await auth.signIn(_email.text, _password.text);
        ref.invalidate(accountProvider);
        if (mounted) _leave();
      } else {
        final needsConfirm = await auth.signUp(_email.text, _password.text);
        if (!mounted) return;
        if (needsConfirm) {
          setState(() {
            _info = 'Check ${_email.text.trim()} for a confirmation link, then sign in.';
            _mode = _Mode.signIn;
          });
        } else {
          ref.invalidate(accountProvider);
          _leave();
        }
      }
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _forgot() async {
    final email = _email.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = 'Enter your email above first, then tap “Forgot password”.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).sendPasswordReset(email);
      if (mounted) setState(() => _info = 'If an account exists for $email, a reset link is on its way.');
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final configured = ref.watch(appConfigProvider).hasAuth;
    final signUp = _mode == _Mode.signUp;
    return Scaffold(
      body: AmbientBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(OSpace.gutter),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: AutofillGroup(
                  child: Form(
                    key: _form,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Reveal(child: Center(child: OrvaneMark(size: 64))),
                        const SizedBox(height: OSpace.lg),
                        Reveal(
                          delay: const Duration(milliseconds: 60),
                          child: AnimatedSwitcher(
                            duration: OMotion.standard,
                            child: Text(
                              signUp ? 'Create your account' : 'Welcome back',
                              key: ValueKey(signUp),
                              style: OType.title1,
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                        const SizedBox(height: OSpace.xs),
                        Text(
                          'Your account authorises your devices on Orvane servers.',
                          style: OType.subhead,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: OSpace.xl),
                        _Segmented(mode: _mode, onChanged: (m) => setState(() {
                              _mode = m;
                              _error = null;
                            })),
                        const SizedBox(height: OSpace.lg),
                        if (!configured) ...[
                          const ONotice(
                            title: 'Sign-in not configured',
                            message: 'This build has no SUPABASE_URL / SUPABASE_ANON_KEY, so accounts are unavailable.',
                            color: OColors.warning,
                            icon: Icons.info_outline_rounded,
                          ),
                          const SizedBox(height: OSpace.md),
                        ],
                        TextFormField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          textInputAction: TextInputAction.next,
                          style: OType.body,
                          decoration: const InputDecoration(labelText: 'Email'),
                          validator: (v) {
                            final s = (v ?? '').trim();
                            if (s.isEmpty) return 'Enter your email';
                            if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(s)) return 'That doesn’t look like an email address';
                            return null;
                          },
                        ),
                        const SizedBox(height: OSpace.sm),
                        TextFormField(
                          controller: _password,
                          obscureText: _obscure,
                          autofillHints: [signUp ? AutofillHints.newPassword : AutofillHints.password],
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _submit(),
                          style: OType.body,
                          decoration: InputDecoration(
                            labelText: 'Password',
                            helperText: signUp ? 'At least 8 characters' : null,
                            helperStyle: OType.caption,
                            suffixIcon: IconButton(
                              tooltip: _obscure ? 'Show password' : 'Hide password',
                              onPressed: () => setState(() => _obscure = !_obscure),
                              icon: Icon(_obscure ? Icons.visibility_rounded : Icons.visibility_off_rounded, color: OColors.textMuted),
                            ),
                          ),
                          validator: (v) {
                            if ((v ?? '').isEmpty) return 'Enter your password';
                            if (signUp && v!.length < 8) return 'Use at least 8 characters';
                            return null;
                          },
                        ),
                        AnimatedSize(
                          duration: OMotion.standard,
                          curve: OMotion.enter,
                          child: Column(
                            children: [
                              if (_error != null) ...[
                                const SizedBox(height: OSpace.md),
                                ONotice(message: _error!, onDismiss: () => setState(() => _error = null)),
                              ],
                              if (_info != null) ...[
                                const SizedBox(height: OSpace.md),
                                ONotice(message: _info!, color: OColors.success, icon: Icons.mark_email_read_rounded),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: OSpace.lg),
                        OButton(
                          label: signUp ? 'Create account' : 'Sign in',
                          loading: _busy,
                          onPressed: configured ? _submit : null,
                        ),
                        if (!signUp)
                          OButton(label: 'Forgot password', variant: OButtonVariant.ghost, onPressed: configured && !_busy ? _forgot : null),
                        const SizedBox(height: OSpace.md),
                        OButton(label: 'Not now', variant: OButtonVariant.secondary, onPressed: _leave),
                        const SizedBox(height: OSpace.lg),
                        Text(
                          'By continuing you agree to the Terms of Service and Privacy Policy.',
                          style: OType.caption.copyWith(color: OColors.textFaint),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Segmented extends StatelessWidget {
  const _Segmented({required this.mode, required this.onChanged});
  final _Mode mode;
  final ValueChanged<_Mode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 46,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(ORadius.md),
        color: OColors.glassFill,
        border: Border.all(color: OColors.glassStroke),
      ),
      child: LayoutBuilder(builder: (context, c) {
        final w = c.maxWidth / 2;
        return Stack(
          children: [
            AnimatedPositioned(
              duration: OMotion.standard,
              curve: OMotion.settle,
              left: mode == _Mode.signIn ? 0 : w,
              width: w,
              top: 0,
              bottom: 0,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(ORadius.sm),
                  color: OColors.glassFillStrong,
                  border: Border.all(color: OColors.glassHighlight),
                ),
              ),
            ),
            Row(
              children: [
                for (final m in _Mode.values)
                  Expanded(
                    child: Pressable(
                      onTap: () => onChanged(m),
                      selected: m == mode,
                      semanticLabel: m == _Mode.signIn ? 'Sign in' : 'Create account',
                      child: Center(
                        child: Text(
                          m == _Mode.signIn ? 'Sign in' : 'Create account',
                          style: OType.callout.copyWith(color: m == mode ? OColors.text : OColors.textMuted),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        );
      }),
    );
  }
}
