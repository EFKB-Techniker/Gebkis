const { sp } = require('@pnp/sp');
const { SPFetchClient } = require('@pnp/nodejs');
const fs = require('fs');
const path = require('path');

async function syncSharePointFile() {
    try {
        sp.setup({
            sp: {
                fetchClientFactory: () => {
                    return new SPFetchClient(
                        process.env.SHAREPOINT_URL,
                        process.env.CLIENT_ID,
                        process.env.CLIENT_SECRET
                    );
                },
            },
        });

        const file = await sp.web
            .getFileByServerRelativeUrl(process.env.SHAREPOINT_FILE_PATH)
            .getBuffer();

        fs.writeFileSync('/app/data/geburtstagskinder.xlsx', file);
        console.log('XLSX Sync:', new Date().toISOString());
    } catch (error) {
        console.error('Sync Error:', error);
    }
}

syncSharePointFile();