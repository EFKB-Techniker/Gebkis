import { spfi } from '@pnp/sp';
import { SPDefault } from '@pnp/nodejs';
import '@pnp/sp/webs/index.js';
import '@pnp/sp/lists/index.js';
import '@pnp/sp/items/index.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sp = spfi().using(SPDefault({
    baseUrl: process.env.SHAREPOINT_URL,
    credentials: {
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET
    }
}));

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/birthdays', async (req, res) => {
    try {
        const items = await sp.web.lists.getByTitle("Geburtstagsliste").items();
        res.json(items);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});