// pkce.js
const generateCodeVerifier = () => {
    const array = new Uint32Array(56 / 2);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).slice(-2)).join('');
};

const base64Encode = (str) => {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

const sha256 = async (codeVerifier) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    return window.crypto.subtle.digest('SHA-256', data);
};

const generateCodeChallenge = async (codeVerifier) => {
    const hashed = await sha256(codeVerifier);
    return base64Encode(hashed);
};

export { generateCodeVerifier, generateCodeChallenge };
