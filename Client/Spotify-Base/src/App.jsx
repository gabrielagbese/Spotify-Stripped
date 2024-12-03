import React, { useEffect, useState } from 'react';
import axios from 'axios';
import queryString from 'query-string';
import { generateCodeVerifier, generateCodeChallenge } from './pkce';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_USER_PROFILE_URL = 'https://api.spotify.com/v1/me';

function App() {
  const [accessToken, setAccessToken] = useState(null);
  const [userName, setUserName] = useState(null);

  // Function to refresh access token
  const refreshToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token');

    if (!refreshToken) {
      console.error('No refresh token available');
      return;
    }

    const data = queryString.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
    });

    try {
      const response = await axios.post(SPOTIFY_TOKEN_URL, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const newAccessToken = response.data.access_token;
      const expiresIn = response.data.expires_in; // Time in seconds

      const newExpirationTime = Date.now() + expiresIn * 1000;

      // Update access token and expiration time in localStorage
      setAccessToken(newAccessToken);
      localStorage.setItem('access_token', newAccessToken);
      localStorage.setItem('expiration_time', newExpirationTime);

      // Automatically refresh the new token before it expires
      scheduleTokenRefresh(expiresIn);
    } catch (error) {
      console.error('Error refreshing token:', error.response?.data || error.message);
    }
  };

  // Function to schedule token refresh before it expires
  const scheduleTokenRefresh = (expiresIn) => {
    const refreshTime = expiresIn * 1000 - 60000; // Refresh 1 minute before token expires
    setTimeout(refreshToken, refreshTime);
  };

  // Function to get the initial token after authorization
  const getToken = async (code, codeVerifier) => {
    const data = queryString.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
      client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      code_verifier: codeVerifier,
    });

    try {
      const response = await axios.post(SPOTIFY_TOKEN_URL, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in; // Time in seconds
      const refreshToken = response.data.refresh_token;

      const expirationTime = Date.now() + expiresIn * 1000;

      // Store tokens and expiration time in localStorage
      setAccessToken(accessToken);
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('expiration_time', expirationTime);
      localStorage.setItem('refresh_token', refreshToken);

      // Automatically refresh token before it expires
      scheduleTokenRefresh(expiresIn);
    } catch (error) {
      console.error('Error fetching access token:', error.response?.data || error.message);
    }
  };

  // Handle authentication code from Spotify after login
  useEffect(() => {
    const handleAuthCode = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const storedCodeVerifier = localStorage.getItem('code_verifier');

      if (code && storedCodeVerifier) {
        await getToken(code, storedCodeVerifier);
        window.history.replaceState({}, document.title, '/');
      } else {
        const storedAccessToken = localStorage.getItem('access_token');
        const expirationTime = localStorage.getItem('expiration_time');

        if (storedAccessToken && expirationTime && Date.now() < expirationTime) {
          // Token is still valid
          setAccessToken(storedAccessToken);
          scheduleTokenRefresh((expirationTime - Date.now()) / 1000);
        } else if (storedAccessToken && expirationTime && Date.now() >= expirationTime) {
          // Token has expired, refresh it
          refreshToken();
        }
      }
    };

    handleAuthCode();
  }, []);

  // Fetch the Spotify user profile once access token is set
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (accessToken) {
        try {
          const response = await axios.get(SPOTIFY_USER_PROFILE_URL, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          setUserName(response.data.display_name);
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    };

    fetchUserProfile();
  }, [accessToken]);

  // Handle Spotify login and redirect for authorization
  const handleLogin = async () => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    localStorage.setItem('code_verifier', codeVerifier);

    const params = {
      client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      scope: 'user-read-private user-read-email',
    };

    window.location = `${SPOTIFY_AUTH_URL}?${queryString.stringify(params)}`;
  };

  return (
    <div>
      {!accessToken ? (
        <button onClick={handleLogin}>Login with Spotify</button>
      ) : (
        <div>
          <h1>Welcome, {userName}!</h1>
        </div>
      )}
    </div>
  );
}

export default App;
