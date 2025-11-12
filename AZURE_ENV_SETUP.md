# Azure Environment Variables Setup

Since the pipeline's service principal doesn't have permission to configure app settings, you need to set these manually in Azure Portal.

## Required Environment Variables

The following environment variables must be configured in your Azure Web App:

### 1. MONGODB_URI
```
mongodb+srv://rallyadmin:h0Gsl9Eb25pU3ubi@rallydevcluster.nmgh40m.mongodb.net/fpay-dev?retryWrites=true&w=majority&appName=RallyDevCluster
```

### 2. NODE_ENV
```
production
```

### 3. PORT
```
8080
```

## How to Configure in Azure Portal

### Method 1: Azure Portal (Recommended for Quick Setup)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Web App: **fpay-webapp**
3. In the left menu, click **Configuration**
4. Under **Application settings**, click **+ New application setting** for each variable:

   **Setting 1:**
   - Name: `MONGODB_URI`
   - Value: `mongodb+srv://rallyadmin:h0Gsl9Eb25pU3ubi@rallydevcluster.nmgh40m.mongodb.net/fpay-dev?retryWrites=true&w=majority&appName=RallyDevCluster`

   **Setting 2:**
   - Name: `NODE_ENV`
   - Value: `production`

   **Setting 3:**
   - Name: `PORT`
   - Value: `8080`

5. Click **Save** at the top
6. Click **Continue** to restart the app

### Method 2: Azure CLI

If you have Azure CLI installed, you can run these commands:

```bash
# Login to Azure
az login

# Set the MongoDB connection string
az webapp config appsettings set \
  --name fpay-webapp \
  --resource-group YOUR_RESOURCE_GROUP_NAME \
  --settings MONGODB_URI="mongodb+srv://rallyadmin:h0Gsl9Eb25pU3ubi@rallydevcluster.nmgh40m.mongodb.net/fpay-dev?retryWrites=true&w=majority&appName=RallyDevCluster"

# Set Node environment
az webapp config appsettings set \
  --name fpay-webapp \
  --resource-group YOUR_RESOURCE_GROUP_NAME \
  --settings NODE_ENV="production"

# Set port
az webapp config appsettings set \
  --name fpay-webapp \
  --resource-group YOUR_RESOURCE_GROUP_NAME \
  --settings PORT="8080"
```

**Note:** Replace `YOUR_RESOURCE_GROUP_NAME` with your actual resource group name.

## Verify Configuration

After configuring the environment variables:

1. The app will automatically restart
2. Wait 2-3 minutes for the restart to complete
3. Visit your app URL: `https://fpay-webapp.azurewebsites.net`
4. You should see:
   - ✓ System Online
   - Database status showing ✓
   - API status showing ✓

## Troubleshooting

### If the app still shows "System Offline":

1. Check the logs:
   - Go to Azure Portal > Your Web App > **Log stream**
   - Look for connection errors or startup issues

2. Verify environment variables are set:
   - Go to Configuration > Application settings
   - Ensure all three variables are present and correct

3. Restart the app:
   - Go to Overview > Click **Restart**
   - Wait 2-3 minutes

### If you see MongoDB connection errors:

- Verify the MongoDB connection string is correct
- Ensure the MongoDB Atlas cluster allows connections from Azure IPs
- Check MongoDB Atlas > Network Access > Add Azure's IP ranges

## Security Best Practices

For production deployments, consider:

1. **Use Azure Key Vault** to store sensitive values like MongoDB connection strings
2. **Enable Managed Identity** for the Web App
3. **Grant Key Vault access** to the Managed Identity
4. **Reference secrets** in app settings using Key Vault references:
   ```
   @Microsoft.KeyVault(SecretUri=https://your-vault.vault.azure.net/secrets/mongodb-uri/)
   ```

## Next Steps

Once environment variables are configured and the app is running:

1. Test the API endpoints at `https://fpay-webapp.azurewebsites.net/api`
2. Create test invoices and payments
3. Monitor the application logs
4. Set up Application Insights for monitoring (recommended)
