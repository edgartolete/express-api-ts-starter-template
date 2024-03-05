import { Request, Response } from 'express';
import { JsonResponse } from '../Utils/responseTemplate';
import { secure } from '../Utils/secure';
import { fakeDelay, generateAccessToken, generateId, tryCatch, tryCatchAsync } from '../Utils/helpers';
import { Log } from '../Connections/mongoDB';
import { getRuntimeConfig } from '../config';
import { UserCreateType, UserFindType, userModel } from '../Models/usersModel';
import jwt, { Secret } from 'jsonwebtoken';
import { redisClient } from '../Connections/redis';

const { encryptionKey } = getRuntimeConfig();

export const authController = {
	signup: async (req: Request, res: Response) => {
		const {
			username = null,
			email = null,
			password = null,
			firstName = null,
			middleName = null,
			lastName = null
		} = req.body;

		if (username == null || email == null || password == null) {
			return JsonResponse.incompleteData(res, 'Required username, email, password');
		}

		const { app: appCode } = req.params;

		const user: UserCreateType = {
			app: { code: appCode },
			id: generateId(),
			username,
			email,
			password: await secure.hash(password)
		};

		const [result, err] = await tryCatchAsync(() => userModel.create(user));

		if (err !== null) {
			return JsonResponse.failed(res, err);
		}

		return JsonResponse.success(res, result, 'Successfully added.');
	},
	verify: async (req: Request, res: Response) => {
		//after the user signup, they need to verify their email address to make sure they are human.
		// receive the token that contains the the username email and password.
	},
	signin: async (req: Request, res: Response) => {
		const apiKey = req.headers['x-api-key'] as string;
		const accessTokenSecret = (req.headers['access-token-secret'] as string) ?? '';
		const refreshTokenSecret = (req.headers['refresh-token-secret'] as string) ?? '';

		const { username = null, email = null, password = null } = req.body;

		if (username == null || password == null) {
			return JsonResponse.incompleteData(res);
		}

		const { app: appCode } = req.params;

		const user: UserFindType = { app: { code: appCode } };

		if (username !== null) user.username = username;

		if (email !== null) user.email = email;

		const [result, err] = await tryCatchAsync(() => userModel.find(user));

		if (err !== null) {
			return JsonResponse.failed(res, err);
		}

		if (result == null) {
			return JsonResponse.success(res, result, 'User not found');
		}

		const [found, passErr] = await tryCatchAsync(() => secure.compare(password, result.password));

		if (passErr !== null) {
			return JsonResponse.failed(res, err);
		}

		if (!found) {
			return JsonResponse.success(res, found, 'Password incorrect');
		}

		const [das, dasErr] = tryCatch(() => secure.decrypt(accessTokenSecret, apiKey));

		if (dasErr !== null) return JsonResponse.error(res, dasErr);
		if (das == null) return JsonResponse.failed1(res, null, 'Access Token Secret Decrypt Failed.');

		const [drs, drsErr] = tryCatch(() => secure.decrypt(refreshTokenSecret, apiKey));

		if (drs == null) return JsonResponse.failed1(res, null, 'Refresh Token Secret Decrypt Failed.');

		if (drsErr !== null) return JsonResponse.error(res, drsErr);

		const [accessToken, atErr] = tryCatch(() => {
			return jwt.sign({ id: result.id, username, email }, das, { expiresIn: '10m' });
		});

		if (atErr !== null) return JsonResponse.error(res, atErr);

		if (accessToken === null) return JsonResponse.failed1(res, null, 'Generating Access Token returned null');

		const [refreshToken, rtErr] = tryCatch(() => {
			return jwt.sign({ id: result.id, username, email }, das, { expiresIn: '10d' });
		});

		if (rtErr !== null) return JsonResponse.error(res, rtErr);

		if (refreshToken === null) return JsonResponse.failed1(res, null, 'Generating Refresh Token returned null');

		redisClient.setEx(`${result.id}-access-token`, 600, accessToken); //10 minutes
		redisClient.setEx(`${result.id}-refresh-token`, 864000, refreshToken); //10 days

		return JsonResponse.success(res, {
			id: result.id,
			accessToken,
			refreshToken
		});
	},
	twoFactorAuthentication: async () => {
		// this should be dynamic based on app if they want to enable.
	},
	refresh: async (req: Request, res: Response) => {
		try {
			const refreshTokenSecret = req.headers['refresh-token-secret'];

			await fakeDelay(3000);
			JsonResponse.success(res);

			return;
		} catch (err) {
			JsonResponse.failed(res, err);
		}
	},
	logout: async (req: Request, res: Response) => {
		const id = req.headers['user-id']?.toString();

		const [redisAt, redisRt] = await Promise.all([
			redisClient.del(`${id}-access-token`),
			redisClient.del(`${id}-refresh-token`)
		]);

		if (redisAt == 0 || redisRt == 0) {
			return JsonResponse.failed1(res, null, 'Failed to Logout.');
		}

		return JsonResponse.success(res, null, 'You are now successfully logged-out');
	},

	forgot: async (req: Request, res: Response) => {
		try {
			JsonResponse.success(res);
			return;
		} catch (err) {
			JsonResponse.failed(res, err);
		}
	}
};
