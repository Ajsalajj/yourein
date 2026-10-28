package app.orvane.vpn.tunnel

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.wireguard.crypto.Key
import com.wireguard.crypto.KeyPair
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Holds this device's WireGuard key pair.
 *
 * The Curve25519 private key is generated on the device and stored only as
 * AES-256-GCM ciphertext, encrypted with a non-exportable key that lives in
 * Android Keystore (hardware-backed where the device supports it). The
 * plaintext private key exists only in memory while a tunnel config is being
 * built, and is never logged or sent over the platform channel.
 */
class KeyVault(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    @Synchronized
    fun keyPair(): KeyPair {
        val stored = prefs.getString(PREF_CIPHERTEXT, null)
        if (stored != null) {
            try {
                return KeyPair(Key.fromBase64(decrypt(stored)))
            } catch (e: Exception) {
                // Keystore key lost (e.g. device restored from backup or
                // lock screen reset). The old key is unrecoverable; make a new one.
            }
        }
        return rotate()
    }

    @Synchronized
    fun rotate(): KeyPair {
        val pair = KeyPair()
        prefs.edit().putString(PREF_CIPHERTEXT, encrypt(pair.privateKey.toBase64())).apply()
        return pair
    }

    fun publicKeyBase64(): String = keyPair().publicKey.toBase64()

    private fun masterKey(): SecretKey {
        val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (ks.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        gen.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                // No user-auth requirement: always-on VPN must start at boot
                // before the user unlocks anything.
                .build()
        )
        return gen.generateKey()
    }

    private fun encrypt(plain: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, masterKey())
        val iv = cipher.iv
        val body = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(iv + body, Base64.NO_WRAP)
    }

    private fun decrypt(encoded: String): String {
        val raw = Base64.decode(encoded, Base64.NO_WRAP)
        val iv = raw.copyOfRange(0, IV_BYTES)
        val body = raw.copyOfRange(IV_BYTES, raw.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, masterKey(), GCMParameterSpec(128, iv))
        return String(cipher.doFinal(body), Charsets.UTF_8)
    }

    private companion object {
        const val PREFS = "orvane.vault"
        const val PREF_CIPHERTEXT = "wg_private_key_v1"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val ALIAS = "orvane.wg.master.v1"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_BYTES = 12
    }
}
