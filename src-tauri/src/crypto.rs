use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine};

pub const ARGON2_MEMORY_KB: u32 = 65536; // 64 MB
pub const ARGON2_ITERATIONS: u32 = 3;
pub const ARGON2_PARALLELISM: u32 = 4;
pub const KEY_LEN: usize = 32;
pub const SALT_LEN: usize = 32;
pub const NONCE_LEN: usize = 12;

/// Generate a random base64-encoded salt.
pub fn generate_salt() -> String {
    let salt: [u8; SALT_LEN] = rand::random();
    B64.encode(salt)
}

/// Derive a 256-bit key from a password and base64 salt using Argon2id.
pub fn derive_key(password: &str, salt_b64: &str) -> Result<[u8; KEY_LEN], String> {
    let salt = B64.decode(salt_b64).map_err(|e| e.to_string())?;
    let params = Params::new(ARGON2_MEMORY_KB, ARGON2_ITERATIONS, ARGON2_PARALLELISM, Some(KEY_LEN))
        .map_err(|e| e.to_string())?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(password.as_bytes(), &salt, &mut key)
        .map_err(|e| e.to_string())?;
    Ok(key)
}

/// Encrypt plaintext bytes. Returns (ciphertext_b64, nonce_b64).
pub fn encrypt(key_bytes: &[u8; KEY_LEN], plaintext: &[u8]) -> Result<(String, String), String> {
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher.encrypt(&nonce, plaintext).map_err(|e| e.to_string())?;
    Ok((B64.encode(ciphertext), B64.encode(nonce)))
}

/// Decrypt ciphertext. Returns plaintext bytes.
pub fn decrypt(key_bytes: &[u8; KEY_LEN], ciphertext_b64: &str, nonce_b64: &str) -> Result<Vec<u8>, String> {
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let ciphertext = B64.decode(ciphertext_b64).map_err(|e| e.to_string())?;
    let nonce_bytes = B64.decode(nonce_b64).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    cipher.decrypt(nonce, ciphertext.as_ref()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_key_is_deterministic() {
        let salt = generate_salt();
        let key1 = derive_key("my-password", &salt).unwrap();
        let key2 = derive_key("my-password", &salt).unwrap();
        assert_eq!(key1, key2);
    }

    #[test]
    fn test_derive_key_differs_with_different_password() {
        let salt = generate_salt();
        let key1 = derive_key("password-a", &salt).unwrap();
        let key2 = derive_key("password-b", &salt).unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_derive_key_differs_with_different_salt() {
        let key1 = derive_key("same-password", &generate_salt()).unwrap();
        let key2 = derive_key("same-password", &generate_salt()).unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let salt = generate_salt();
        let key = derive_key("test-password", &salt).unwrap();
        let plaintext = b"Hello, Yek!";
        let (ct, nonce) = encrypt(&key, plaintext).unwrap();
        let decrypted = decrypt(&key, &ct, &nonce).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_decrypt_fails_with_wrong_key() {
        let salt = generate_salt();
        let key1 = derive_key("correct", &salt).unwrap();
        let key2 = derive_key("wrong", &salt).unwrap();
        let (ct, nonce) = encrypt(&key1, b"secret").unwrap();
        assert!(decrypt(&key2, &ct, &nonce).is_err());
    }

    #[test]
    fn test_decrypt_fails_with_tampered_ciphertext() {
        let salt = generate_salt();
        let key = derive_key("password", &salt).unwrap();
        let (ct, nonce) = encrypt(&key, b"secret").unwrap();
        let tampered = ct.replace('A', "B");
        assert!(decrypt(&key, &tampered, &nonce).is_err());
    }
}
