const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { RDSClient } = require('@aws-sdk/client-rds');
const { DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');

const s3Client = new S3Client({ region: 'us-east-1' });
const ec2Client = new EC2Client({ region: 'us-east-1' });
const rdsClient = new RDSClient({ region: 'us-east-1' });

const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors');

module.exports = rdsClient;

app.use(cors());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

app.get('/buckets', async (req, res) => {
    try {
        const data = await s3Client.send(new ListBucketsCommand({}));
        res.json(data.Buckets);
    } catch (err) {
        console.error("Error", err);
        res.status(500).send("An error occurred while fetching buckets");
    }
});

app.get('/instances', async (req, res) => {
    try {
        const data = await ec2Client.send(new DescribeInstancesCommand({}));
        const instances = data.Reservations.flatMap(reservation => reservation.Instances);
        res.json(instances);
    } catch (err) {
        console.error("Error", err);
        res.status(500).send("An error occurred while fetching instances");
    }
});

app.get('/rds-instances', async (req, res) => {
    try {
        const data = await rdsClient.send(new DescribeDBInstancesCommand({}));
        res.json(data.DBInstances);
    } catch (err) {
        console.error("Error", err);
        res.status(500).send("Failed to fetch RDS instances");
    }
});