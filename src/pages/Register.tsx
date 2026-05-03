import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/Client';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';

function toBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

export default function Register() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('STEP A: starting key generation');

      // 🔐 RSA keypair
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
      );

      console.log('STEP B: keypair generated');

      // 🔑 Export public key
      const publicKeyRaw = await window.crypto.subtle.exportKey(
        'spki',
        keyPair.publicKey
      );

      const publicKeyBase64 = toBase64(publicKeyRaw);

      // 🧂 Salt
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = toBase64(salt.buffer);

      console.log('STEP C: deriving AES key');

      const encoder = new TextEncoder();

      const passwordKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      // 🔐 AES-GCM key (replaces AES-KW completely)
      const aesKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        passwordKey,
        {
          name: 'AES-GCM',
          length: 256,
        },
        false,
        ['encrypt', 'decrypt']
      );

      console.log('STEP D: AES-GCM key ready');

      // =========================
      // 🔐 Encrypt private key (AES-GCM replacement for wrapKey)
      // =========================

      console.log('STEP G: encrypting private key');

      const privateKeyRaw = await window.crypto.subtle.exportKey(
        'pkcs8',
        keyPair.privateKey
      );

      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      const encryptedPrivateKey = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        aesKey,
        privateKeyRaw
      );

      console.log('STEP H: encryption successful');

      // Combine IV + ciphertext
      const combined = new Uint8Array(
        iv.byteLength + encryptedPrivateKey.byteLength
      );

      combined.set(iv, 0);
      combined.set(new Uint8Array(encryptedPrivateKey), iv.byteLength);

      const wrappedPrivateKeyBase64 = toBase64(combined.buffer);

      console.log('STEP I: sending payload');

      const response = await apiClient.post('/auth/register', {
        username,
        display_name: displayName,
        password,
        public_key: publicKeyBase64,
        wrapped_private_key: wrappedPrivateKeyBase64,
        pbkdf2_salt: saltBase64,
      });

      const token = response.data.access_token;

      login(token);
      navigate('/chat');

    } catch (err: unknown) {
      console.error('Register error:', err);

      let errorMessage = 'Registration failed.';

      if (axios.isAxiosError(err)) {
        errorMessage =
          err.response?.data?.message ||
          JSON.stringify(err.response?.data, null, 2);
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-gray-900 rounded-2xl">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">
          Whisperbox
        </h1>

        <p className="text-gray-400 text-center mb-8">
          Create your secure account
        </p>

        {error && (
          <div className="bg-red-900/70 border border-red-600 text-red-200 px-4 py-4 rounded-xl mb-6 text-sm whitespace-pre-wrap">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-xl"
            required
          />

          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display Name"
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-xl"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-xl"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}