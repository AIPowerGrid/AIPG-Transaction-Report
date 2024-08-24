const express = require('express');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const redis = require('redis');
const client = redis.createClient();

client.connect();

client.on('connect', async function() {
    console.log('Connected!');
});

client.on('error', (err) => {
    console.error('Redis client encountered an error:', err);
});

client.on('end', () => {
    console.log('Redis client disconnected');
});

const app = express();
const port = 8443;

// Middleware and route configurations
app.use(express.static('public'));
app.use(express.json());

// Function to process the task in the background
function processTask(jobId, address) {
    const pythonProcess = spawn('python3', ['./src/server.py', address]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Child process exited with code ${code}`);
        if (code === 0) {
            const filePath = './public/AIPG-transactions.csv';
            if (fs.existsSync(filePath)) {
                console.log("File generated, updating task to 'completed'");
                client.hSet(jobId, 'status', 'completed', 'file', filePath);
            } else {
                console.log("Error: File not found");
                client.hSet(jobId, 'status', 'failed');
            }
        } else {
            console.log("Internal server error");
            client.hSet(jobId, 'status', 'failed');
        }
    });
}

// Route to process the task
app.post('/generate', async (req, res) => {
    console.log("Received POST request to generate transaction report");
    const { address } = req.body;
    console.log("Received address:", address);
    const jobId = uuidv4();

    try {
        // Set initial status in Redis
        await client.hSet(jobId, 'status', 'in-progress');
        console.log(`Initial status set for Job ID ${jobId}`);

        // Simulate the task processing (replace with your actual logic)
        processTask(jobId, address, async () => {
            console.log("File generated, updating task to 'completed'");
            await client.hSet(jobId, 'status', 'completed');

            // Verify the status in Redis
            const statusCheck = await client.hGetAll(jobId);
            console.log("Redis status after setting:", statusCheck);
        });

        res.json({ job_id: jobId });
    } catch (err) {
        console.error("Error processing the task:", err);
        res.status(500).send('Internal server error');
    }
});

// Route to check the status of the task
app.get('/status/:jobId', async (req, res) => {
    const job_id = req.params.jobId;
    console.log(`Job ID: ${job_id}`);

    try {
        const obj = await client.hGetAll(job_id);
        const normalizedObj = Object.assign({}, obj);  // Normalize the object

        console.log("Redis response:", normalizedObj);

        if (Object.keys(normalizedObj).length === 0) {
            return res.status(404).send('Task not found');
        }

        res.json(normalizedObj); // Send the task status back to the client
    } catch (err) {
        console.error("Error querying task status in Redis:", err);
        res.status(500).send('Internal server error');
    }
});

// Route for health check of the application
app.get('/health', (req, res) => {
    res.send({ status: 'ok' });
});

http.createServer(app).listen(port, () => {
    console.log(`Server running on port ${port}`);
});



