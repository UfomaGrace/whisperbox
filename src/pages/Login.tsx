import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import apiClient from '../api/Client';

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, setPrivateKey } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('STEP 1: login request');

      const response = await apiClient.post("/auth/login", {
        username,
        password,
      });

      const {
        access_token,
        user,
      } = response.data;

      console.log('STEP 2: extracting encrypted key data');

      const wrappedPrivateKeyBase64 = user.wrapped_private_key;
      const saltBase64 = user.pbkdf2_salt;

      const wrappedData = fromBase64(wrappedPrivateKeyBase64).buffer as ArrayBuffer;
      const salt = fromBase64(saltBase64).buffer as ArrayBuffer;

      // 🔐 split IV + ciphertext
      const iv = wrappedData.slice(0, 12);
      const encryptedPrivateKey = wrappedData.slice(12);

      console.log('STEP 3: deriving AES key');
      

      const encoder = new TextEncoder();

      const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const aesKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        passwordKey,
        {
          name: 'AES-GCM',
          length: 256,
        },
        false,
        ['decrypt']
      );

      console.log('STEP 4: decrypting private key');

      const privateKeyRaw = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        aesKey,
        encryptedPrivateKey
      );

      console.log('STEP 5: importing RSA private key');

      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyRaw,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        true,
        ['decrypt']
      );

      console.log('STEP 6: login complete');

      // 🔐 store auth token
      login(access_token);

      // OPTIONAL: store private key in memory/state/context
      setPrivateKey(privateKey);

      navigate('/chat');

    } catch (err: unknown) {
      console.error("Login error:", err);

      let errorMessage = "Login failed. Please check your credentials.";

      if (axios.isAxiosError(err)) {
        errorMessage =
          err.response?.data?.message ||
          JSON.stringify(err.response?.data);
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
          Sign in to your secure account
        </p>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white"
              placeholder="your_username"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-semibold rounded-xl"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-8">
          Don't have an account?{' '}
          <span
            onClick={() => navigate('/register')}
            className="text-blue-400 cursor-pointer"
          >
            Create one
          </span>
        </p>
      </div>
    </div>
  );
}