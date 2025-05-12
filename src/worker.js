self.onmessage = async function(e) {
    if (e.data.type === 'writeFile') {
        try {
            const response = await fetch(e.data.path, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                body: e.data.data
            });

            if (!response.ok) {
                throw new Error(`Failed to save file: ${response.statusText}`);
            }

            self.postMessage({ type: 'success', path: e.data.path });
        } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
        }
    }
};