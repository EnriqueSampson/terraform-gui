const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { RDSClient } = require('@aws-sdk/client-rds');
const { DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const { GlueClient, GetDatabasesCommand, GetTablesCommand, GetTableCommand } = require('@aws-sdk/client-glue');

const glueClient = new GlueClient({ region: 'us-east-1' });
const s3Client = new S3Client({ region: 'us-east-1' });
const ec2Client = new EC2Client({ region: 'us-east-1' });
const rdsClient = new RDSClient({ region: 'us-east-1' });

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
const cors = require('cors');

module.exports = rdsClient;

app.use(cors());
app.use(express.json());
app.use(bodyParser.json({ limit: '10mb' }));

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

app.get('/glue-tables', async (req, res) => {
    try {
        const databasesData = await glueClient.send(new GetDatabasesCommand({}));
        const databases = databasesData.DatabaseList.map(db => ({ database: db.Name, tables: [] }));
        res.json(databases);
    } catch (err) {
        console.error("Error", err);
        res.status(500).send("Failed to fetch Glue databases");
    }
});

app.get('/glue-tables/:databaseName', async (req, res) => {
    const { databaseName } = req.params;
    try {
        const tablesResponse = await glueClient.send(new GetTablesCommand({ DatabaseName: databaseName }));
        let tableDetailsPromises = tablesResponse.TableList.map(table => glueClient.send(new GetTableCommand({
            DatabaseName: databaseName,
            Name: table.Name
        })));
        let tablesWithSchema = await Promise.all(tableDetailsPromises);
        const tablesData = tablesWithSchema.map(details => ({
            name: details.Table.Name,
            schema: details.Table.StorageDescriptor.Columns
        }));
        res.json(tablesData);
    } catch (err) {
        console.error("Error fetching tables for database", databaseName, err);
        res.status(500).send(`Failed to fetch tables for database ${databaseName}`);
    }
});

app.post('/generate-terraform', (req, res) => {
    try {
        const { resourceType, resourceData } = req.body;
        const terraformConfig = generateTerraformConfig(resourceType, resourceData);
        res.send(terraformConfig);
    } catch (err) {
        console.error("Error", err);
        res.status(500).send(`Failed to generate Terraform configuration: ${err.message}`);
    }
});

function generateTerraformConfig(resourceType, resourceData) {
    switch (resourceType) {
        case 'rds':
            return generateRdsTerraformConfig(resourceData);
        case 's3':
            return generateS3TerraformConfig(resourceData);
        case 'ec2':
            return generateEC2TerraformConfig(resourceData);
        // Other cases...
        default:
            throw new Error(`Unsupported resource type: ${resourceType}`);
    }
}

function generateEC2TerraformConfig(ec2Instances) {
    let terraformHcl = `# Terraform configuration for AWS EC2 Instances\n`;

    ec2Instances.forEach(instance => {
        terraformHcl += `
resource "aws_instance" "${instance.InstanceId}" {
    ami           = "${instance.ImageId}"
    instance_type = "${instance.InstanceType}"
    // Add additional configurations as needed

    tags = {
        Name = "${instance.InstanceId}"
    }
}
`;
    });

    return terraformHcl;
}

function generateS3TerraformConfig(s3Buckets) {
    let terraformHcl = `# Terraform configuration for AWS S3 Buckets\n`;

    s3Buckets.forEach(bucket => {
        terraformHcl += `
resource "aws_s3_bucket" "${bucket.Name.replace(/[^a-zA-Z0-9]/g, "_")}" {
    bucket = "${bucket.Name}"
    acl    = "private"
    # Add more S3 bucket configurations as needed
}
`;
    });

    return terraformHcl;
}

function generateRdsTerraformConfig(rdsInstances) {
    let terraformHcl = `# Terraform configuration for AWS RDS Instances\n`;

    rdsInstances.forEach(instance => {
        terraformHcl += `
resource "aws_db_instance" "${instance.DBInstanceIdentifier}" {
    allocated_storage    = ${instance.AllocatedStorage}
    engine               = "${instance.Engine}"
    instance_class       = "${instance.DBInstanceClass}"
    storage_type         = "${instance.StorageType}"
    username             = "${instance.MasterUsername}"
    password             = "REPLACE_WITH_ACTUAL_PASSWORD"
    parameter_group_name = "${instance.DBParameterGroups && instance.DBParameterGroups.length > 0 ? instance.DBParameterGroups[0].DBParameterGroupName : 'default'}"
    skip_final_snapshot  = true
    # Add more attributes as needed
}
`;
    });

    return terraformHcl;
}

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

