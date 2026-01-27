export function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Playwright Dashboard</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        .card { border: 1px solid #e1e4e8; padding: 16px; margin-bottom: 16px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        h1 { font-size: 1.5rem; margin-bottom: 1rem; }
        h3 { font-size: 1.2rem; margin-top: 0; }
        img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; display: block; margin-top: 10px; }
        button { cursor: pointer; padding: 6px 12px; background: #0366d6; color: white; border: none; border-radius: 4px; font-size: 14px; }
        button:hover { background: #005cc5; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        ul { list-style: none; padding: 0; }
        li { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        li:last-child { border-bottom: none; }
        .tab-url { color: #586069; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
        .error { color: #cb2431; padding: 10px; background: #ffeef0; border-radius: 4px; display: none; }
    </style>
</head>
<body>
    <h1>Playwright Dashboard</h1>
    <div id="error" class="error"></div>

    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3>Live Preview</h3>
            <button id="refresh">Refresh</button>
        </div>
        <img id="preview" src="" alt="Browser Preview" style="display: none;" />
        <div id="loading-preview">Loading preview...</div>
    </div>

    <div class="card">
        <h3>Open Tabs</h3>
        <ul id="tabs">
            <li>Loading tabs...</li>
        </ul>
    </div>

    <script type="module">
        import { createClient } from 'https://esm.sh/@modelcontextprotocol/ext-apps@1.0.1';

        const client = createClient();
        const previewImg = document.getElementById('preview');
        const loadingPreview = document.getElementById('loading-preview');
        const tabsList = document.getElementById('tabs');
        const refreshBtn = document.getElementById('refresh');
        const errorDiv = document.getElementById('error');

        function showError(msg) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
            setTimeout(() => errorDiv.style.display = 'none', 5000);
        }

        async function updatePreview() {
            try {
                loadingPreview.style.display = 'block';
                previewImg.style.display = 'none';
                refreshBtn.disabled = true;

                const result = await client.callTool('browser_take_screenshot', {
                    type: 'jpeg',
                    quality: 50,
                    expectation: { includeSnapshot: false } // Reduce token usage/overhead
                });

                // Screenshot tool usually returns image content
                const image = result.content.find(c => c.type === 'image');

                if (image) {
                    previewImg.src = \`data:\${image.mimeType};base64,\${image.data}\`;
                    previewImg.style.display = 'block';
                } else {
                    console.warn('No image in screenshot result', result);
                }
            } catch (e) {
                console.error('Failed to take screenshot', e);
                showError('Failed to refresh preview: ' + e.message);
            } finally {
                loadingPreview.style.display = 'none';
                refreshBtn.disabled = false;
            }
        }

        async function updateTabs() {
            try {
                const result = await client.callTool('browser_tab_list', {
                    expectation: { includeSnapshot: false }
                });

                const textContent = result.content.find(c => c.type === 'text');

                if (textContent) {
                    const text = textContent.text;
                    const lines = text.split('\\n')
                        .map(l => l.trim())
                        .filter(l => l.startsWith('-')); // Filter tab lines

                    if (lines.length === 0) {
                         tabsList.innerHTML = '<li>No open tabs found.</li>';
                    } else {
                        tabsList.innerHTML = lines.map(line => {
                            // Format: "- 0: [Title] (URL)" or "- 0: (current) [Title] (URL)"
                            // We can display it as is or parse it. Displaying as is simpler.
                            // Remove leading "- "
                            const content = line.substring(2);
                            return \`<li><span>\${content}</span></li>\`;
                        }).join('');
                    }
                }
            } catch (e) {
                console.error('Failed to list tabs', e);
                showError('Failed to list tabs: ' + e.message);
            }
        }

        async function refresh() {
            await Promise.all([updatePreview(), updateTabs()]);
        }

        refreshBtn.addEventListener('click', refresh);

        // Initial load
        refresh();
    </script>
</body>
</html>`;
}
