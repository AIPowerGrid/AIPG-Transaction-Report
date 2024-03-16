const express = require('express');
const https = require('https');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const port = 8443;

// Middleware and route configurations

const options = {
  key: fs.readFileSync('/etc/certs/server.key'), // Path to your private key
  cert: fs.readFileSync('/etc/certs/server.crt'),  // Path to your SSL/TLS certificate
  requestCert: false,
  rejectUnauthorized: false
};

// Create HTTPS server using the configured options
const server = https.createServer(options, app);

app.use(express.static('public'));
app.use(express.json())

app.post('/generate', (req, res) => {
    console.log("Received POST request to generate transaction report");
    const { address } = req.body;
    console.log("Received address:", address);

    const pythonProcess = spawn('python', ['./src/server.py', address]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
        if (code === 0) {
            // Check if the file exists, then send it for download
            const filePath = './public/AIPG-transactions.csv';
            if (fs.existsSync(filePath)) {
                console.log("Sending generated file for download");
                res.download(filePath);
            } else {
                console.log("Error: File not found");
                res.status(500).send('Error: File not found');
            }
        } else {
            console.log("Internal Server Error");
            res.status(500).send('Internal Server Error');
        }
    });
});

// Start HTTPS server on port 443
server.listen(port, () => {
  console.log(`HTTPS Server is running on port ${port}`);
});
