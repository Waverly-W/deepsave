import { useState } from 'react';
import axios from 'axios';

export default function Popup() {
  const [token, setToken] = useState(localStorage.getItem('ds_token'));
  const [status, setStatus] = useState('idle');

  const handleLogin = async (e: any) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const totp = e.target.totp.value;

    try {
      const res = await axios.post('http://localhost:8000/api/v1/login/access-token', {
        username: email,
        password: password,
        totp_code: totp || undefined
      });
      localStorage.setItem('ds_token', res.data.access_token);
      setToken(res.data.access_token);
    } catch (err) {
      alert('Login failed');
    }
  };

  const handleSaveCurrentTab = async () => {
    setStatus('saving');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!token) return;

    try {
      await axios.post('http://localhost:8000/api/v1/ingest', {
        url: tab.url,
        title: tab.title
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus('saved');
    } catch (err) {
      setStatus('error');
    }
  };

  if (!token) {
    return (
      <div className="p-4 bg-zinc-950 h-full text-white">
        <h2 className="text-xl mb-4 font-bold">DeepSave Pro</h2>
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <input name="email" placeholder="Email" className="p-2 rounded bg-zinc-900 border border-zinc-800" />
          <input name="password" type="password" placeholder="Password" className="p-2 rounded bg-zinc-900 border border-zinc-800" />
          <input name="totp" placeholder="2FA Code" className="p-2 rounded bg-zinc-900 border border-zinc-800" />
          <button type="submit" className="bg-blue-600 p-2 rounded text-white font-bold">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-4 bg-zinc-950 h-full text-white flex flex-col items-center justify-center">
      <h2 className="text-xl mb-6 font-bold">DeepSave Pro</h2>
      <button
        onClick={handleSaveCurrentTab}
        disabled={status === 'saving' || status === 'saved'}
        className="bg-green-600 px-6 py-3 rounded-full font-bold w-full disabled:opacity-50"
      >
        {status === 'idle' && 'Save Current Tab'}
        {status === 'saving' && 'Saving...'}
        {status === 'saved' && 'Saved!'}
        {status === 'error' && 'Failed'}
      </button>
      <button onClick={() => { localStorage.removeItem('ds_token'); setToken(null); }} className="mt-4 text-xs text-zinc-500 underline">Logout</button>
    </div>
  );
}
