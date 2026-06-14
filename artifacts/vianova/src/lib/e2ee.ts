/**
 * e2ee.ts - End-to-End Encryption Utilities for ViaNovaIA
 * 
 * Uses Web Crypto API to generate ECDH key pairs and derive shared secrets
 * for end-to-end encrypted messaging.
 */

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true, // extractable
    ["deriveKey", "deriveBits"]
  );
}

export async function exportPublicKey(keyPair: CryptoKeyPair): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const exportedAsString = String.fromCharCode.apply(null, Array.from(new Uint8Array(exported)));
  return btoa(exportedAsString);
}

export async function exportPrivateKey(keyPair: CryptoKeyPair): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const exportedAsString = String.fromCharCode.apply(null, Array.from(new Uint8Array(exported)));
  return btoa(exportedAsString);
}

export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const binaryDerString = atob(base64Key);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

export async function deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(sharedSecret: CryptoKey, plaintext: string): Promise<{ ciphertext: string, iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedSecret,
    encoded
  );

  const ciphertextB64 = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(encrypted))));
  const ivB64 = btoa(String.fromCharCode.apply(null, Array.from(iv)));
  
  return { ciphertext: ciphertextB64, iv: ivB64 };
}

export async function decryptMessage(sharedSecret: CryptoKey, ciphertextB64: string, ivB64: string): Promise<string> {
  const ciphertext = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sharedSecret,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
