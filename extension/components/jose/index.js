import { SignJWT } from './jwt/sign.js';
import { encoder } from './lib/buffer_utils.js';
import { encode as base64url } from './runtime/base64url.js';
import digest from './runtime/digest.js';

globalThis.JWSgenerate = async (apikey, ttl=86400) => {
	const now = Math.floor(Date.now() / 1000);
	const [api_key, srt_key] = apikey.split('.');
	const secret = new TextEncoder().encode(srt_key);

	const sign = await new SignJWT({
		api_key,
		exp: now + ttl
	})
	.setProtectedHeader({
		"alg": "HS256",
		"sign_type": "SIGN"
	})
	.sign(secret)
	;
	return sign;
};
globalThis.signJWT = async (accessKey, secretKey, ttl=1800, before=5) => {
	const now = Math.round(Date.now() / 1000);
	const secret = new TextEncoder().encode(secretKey);

	const sign = await new SignJWT()
	.setProtectedHeader({
		"alg": "HS256",
		"typ": "JWT"
	})
	.setIssuer(accessKey)
	.setExpirationTime(now + ttl)
	.setNotBefore(now - before)
	.sign(secret)
	;
	return sign;
};
globalThis.compileUserInfo = async (username, password) => {
	const info = {username, password};
	const data = encoder.encode(JSON.stringify(info));
	return base64url(await digest('sha256', data));
};