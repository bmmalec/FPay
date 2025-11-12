# Azure Pipeline Setup Instructions

This guide will walk you through setting up the Azure Pipeline for the FPay - Freight Payment Platform.

## Prerequisites

1. Azure DevOps account with access to the FPay project
2. Azure subscription with appropriate permissions
3. Repository already configured in Azure DevOps

## Step 1: Create Azure Web App

1. Go to [Azure Portal](https://portal.azure.com)
2. Click "Create a resource"
3. Search for "Web App" and select it
4. Click "Create"
5. Fill in the details:
   - **Subscription**: Select your subscription
   - **Resource Group**: Create new or use existing (e.g., "fpay-resources")
   - **Name**: Enter a unique name (e.g., "fpay-webapp" - this will be your URL: fpay-webapp.azurewebsites.net)
   - **Publish**: Code
   - **Runtime stack**: Select a runtime (e.g., Node.js, .NET, or PHP for static sites)
   - **Operating System**: Linux or Windows
   - **Region**: Choose your preferred region
   - **App Service Plan**: Create new or select existing
6. Click "Review + Create" then "Create"
7. Wait for deployment to complete
8. Note down your Web App name - you'll need this for the pipeline

## Step 2: Create Azure Service Connection

1. Go to [Azure DevOps](https://dev.azure.com/bmdesigns/FPay)
2. Navigate to your FPay project
3. Click "Project settings" (bottom left)
4. Under "Pipelines", click "Service connections"
5. Click "New service connection"
6. Select "Azure Resource Manager" and click "Next"
7. Choose authentication method:
   - **Recommended**: "Service principal (automatic)"
8. Fill in the details:
   - **Scope level**: Subscription
   - **Subscription**: Select your Azure subscription
   - **Resource group**: Select the resource group containing your Web App
   - **Service connection name**: "Azure-Service-Connection" (or update the pipeline YAML with your chosen name)
   - Check "Grant access permission to all pipelines"
9. Click "Save"

## Step 3: Update Pipeline Variables

1. Open the `azure-pipelines.yml` file in your repository
2. Update the following variables at the top of the file:
   ```yaml
   variables:
     azureWebAppName: 'your-webapp-name'  # Replace with your actual Azure Web App name
     azureSubscription: 'Azure-Service-Connection'  # Use the service connection name from Step 2
   ```
3. Commit and push the changes

## Step 4: Create the Pipeline in Azure DevOps

1. Go to [Azure DevOps](https://dev.azure.com/bmdesigns/FPay)
2. Navigate to your FPay project
3. Click "Pipelines" in the left sidebar
4. Click "New Pipeline" or "Create Pipeline"
5. Select "Azure Repos Git" (since your code is in Azure DevOps)
6. Select your "FPay" repository
7. Select "Existing Azure Pipelines YAML file"
8. Choose the branch and path:
   - **Branch**: Select your branch (e.g., claude/freight-payment-platform-011CV3QmWg36BNPPb7LnoZ2k or main)
   - **Path**: `/azure-pipelines.yml`
9. Click "Continue"
10. Review the pipeline YAML
11. Click "Run" to create and run the pipeline for the first time

## Step 5: Configure Environment (Optional but Recommended)

1. In Azure DevOps, go to "Pipelines" > "Environments"
2. Click "New environment"
3. Name it "production" (this matches the pipeline YAML)
4. Choose "None" for resource
5. Click "Create"
6. (Optional) Add approvals and checks:
   - Click on the environment
   - Click the three dots menu > "Approvals and checks"
   - Add required approvers before deployment

## Step 6: Monitor and Verify Deployment

1. After creating the pipeline, it should automatically trigger
2. Watch the pipeline run:
   - Click "Pipelines" in Azure DevOps
   - Click on your pipeline run
   - Monitor each stage (Build and Deploy)
3. Once complete, verify the deployment:
   - Go to your Azure Web App URL: `https://your-webapp-name.azurewebsites.net`
   - You should see the FPay landing page

## Pipeline Triggers

The pipeline is configured to trigger automatically on:
- Pushes to the `main` branch
- Pushes to any `claude/*` branches

To modify triggers, edit the `trigger` section in `azure-pipelines.yml`.

## Troubleshooting

### Pipeline Fails to Connect to Azure
- Verify your service connection is properly configured
- Ensure the service principal has permissions to the Web App
- Check that the subscription and resource group are correct

### Deployment Succeeds but Site Shows Error
- Check the Web App logs in Azure Portal
- Verify the runtime stack matches your application requirements
- Ensure all required files are included in the build artifact

### Pipeline Not Triggering Automatically
- Check the trigger configuration in `azure-pipelines.yml`
- Verify you're pushing to the correct branch
- Check if the pipeline has appropriate permissions

## Additional Configuration

### Custom Domain
To add a custom domain to your Web App:
1. Go to your Web App in Azure Portal
2. Click "Custom domains" in the left menu
3. Follow the instructions to add and verify your domain

### SSL Certificate
Azure Web Apps come with a free SSL certificate for *.azurewebsites.net domains. For custom domains:
1. Go to "TLS/SSL settings" in your Web App
2. Add a certificate or use App Service Managed Certificate (free)

### Environment Variables
To add environment variables:
1. Go to your Web App in Azure Portal
2. Click "Configuration" in the left menu
3. Add application settings as needed

## Support

For issues or questions:
- Check Azure DevOps documentation: https://docs.microsoft.com/azure/devops/
- Check Azure App Service documentation: https://docs.microsoft.com/azure/app-service/
- Contact your Azure administrator

## Security Notes

- Never commit PAT tokens or secrets to the repository
- Use Azure Key Vault for storing sensitive configuration
- Regularly review service connection permissions
- Enable authentication on your Web App if needed
