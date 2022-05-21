// Initialize debugger
import Debugger from 'debug';
const debug = Debugger('xss:api:portal');

import validator from 'validator';

import * as db from '../db';
import { generateToken, getPasswordHash, requireAuthMiddleware } from '../auth';

// Express Router
import { Router } from 'express';
const router = Router();

// User signup
router.post('/user/signup', async (req, res) => {
    // Extract relevant fields
    const { name, password, email } = req.body;
    if (!name)
        return res.status(400).send('missing name');
    if (!email)
        return res.status(400).send('missing email');
    if (!password)
        return res.status(400).send('missing password');
    if (!validator.isEmail(email))
        return res.status(400).send('invalid email');

    // Verify email not duplicate
    const dupEmail = await db.queryProm('SELECT 1 FROM Users WHERE email = ?;', [email], true);
    if (dupEmail instanceof Error) {
        console.error(dupEmail);
        return res.status(500).send('database failure: ');
    }
    if (dupEmail.length)
        return res.status(400).send('email already in use');

    // Put user into the database
    let userId;
    for (;;) {
        // Make pw hash
        userId = Math.random() * Number.MAX_SAFE_INTEGER;
        const pwHash = getPasswordHash(String(userId), password);

        // Try to create user
        const result = await db.queryProm(
            'INSERT INTO Users (userId, name, email, passwordHash, creationTs) VALUES (?, ?, ?, ?, ?);',
            [userId, name, email, pwHash, Date.now()],
            false,
        );

        // Somehow duplicate key
        if (result instanceof Error) {
            if (result.message.match(/Duplicate entry '.+' for key 'PRIMARY'/))
                continue;
            console.error(result);
            return res.status(500).send(result);
        }

        break;
    }

    debug('New user: ', email, name);

    // Log the user in
    // const token = await generateToken(userId, req.body.stayLoggedIn);
    // res.send(token);
});

// User login
router.post('/user/login', async (req, res) => {
    const { email, password, stayLoggedIn } = req.body;

    const user = await db.queryProm('SELECT userId, hashedPassword FROM Users WHERE email = ?;', [email], true);
    if (user instanceof Error) {
        console.error(user);
        return res.status(500).send(user);
    }
    if (!user[0])
        return res.status(401).send('wrong email');
    if (getPasswordHash(user[0].userId, password) !== user[0].hashedPassword)
        return res.status(401).send('wrong password');

    res.send(await generateToken(user[0].userId, stayLoggedIn));
    debug('user logged in', email);
});

// List a user's functions
router.get('/functions/', requireAuthMiddleware, async (req, res) => {
    const userId = req.session;

    const fns = await db.queryProm(
        'SELECT functionId, name, about, creationTs, reusePolicy FROM Functions WHERE userId = ?;',
        [userId],
        true,
    );
    if (fns instanceof Error)
        return res.status(500).send(fns);

    res.json(fns);
});

// Describe a function
router.get('/function/:fnId', requireAuthMiddleware, async (req, res) => {
    const userId = req.session;
    const { fnId } = req.params;

    const fnq = await db.queryProm(
        'SELECT functionId, name, about, creationTs, reusePolicy FROM Functions WHERE functionId = ? AND userId = ?;',
        [ fnId, userId ],
        true,
    );
    if (fnq instanceof Error)
        return res.status(500).send(fnq);
    if (fnq.length === 0)
        return res.status(404).send('not found');
    const fn = fnq[0];

    const logCount = await db.queryProm('SELECT COUNT(*) AS numLogs FROM FunctionLogs WHERE functionId = ?;', [fnId], true);
    if (logCount instanceof Error)
        console.error(logCount);
    else
        fn.logCount = logCount[0].numLogs;

    const assets = await db.queryProm(
        'SELECT assetId, LENGTH(contents) AS size, fileName, creationTs, modifiedTs '
        + 'FROM FunctionAssets WHERE functionId = ?;',
        [fnId],
        true,
    );
    if (assets instanceof Error)
        console.error(logCount);
    fn.assets = assets instanceof Error ? [] : assets;

    res.json(fn);
});

// TODO
// User logout
// Update user
// User stats
// List functions
// Create function
// Delete function
// Update function
// Upload file for function
// List workers
// Enable/Disable worker (to allow safe shutdown)

export default router;