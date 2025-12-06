# MongoDB Atlas Setup Guide

This guide walks you through setting up MongoDB Atlas (cloud) for your HabitFlowAI project.

## Step-by-Step Setup

### 1. Create/Login to MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for a free account (or log in if you have one)
3. Create a new organization (or use existing)

### 2. Create a Free Cluster

1. Click **"Build a Database"** or **"Create"** → **"Database"**
2. Choose **"M0 Free"** tier (Free Forever)
3. Select a cloud provider and region (choose closest to you)
4. Name your cluster (e.g., "HabitFlowAI")
5. Click **"Create"** (takes 3-5 minutes)

### 3. Create Database User

1. Go to **"Database Access"** (left sidebar)
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Enter a username (e.g., `habitflowai-user`)
5. Click **"Autogenerate Secure Password"** (save this password!)
6. Under "Database User Privileges", select **"Read and write to any database"**
7. Click **"Add User"**

**⚠️ IMPORTANT:** Save your username and password - you'll need them for the connection string!

### 4. Configure Network Access

1. Go to **"Network Access"** (left sidebar)
2. Click **"Add IP Address"**
3. For development, click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
   - **Note:** For production, restrict to specific IPs
4. Click **"Confirm"**

### 5. Get Connection String

1. Go to **"Database"** (left sidebar)
2. Click **"Connect"** on your cluster
3. Choose **"Drivers"** (this is what you need!)
4. Select:
   - **Driver:** Node.js
   - **Version:** 5.5 or later (or latest)
5. Copy the connection string (looks like):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### 6. Configure Your Project

1. **Create/update `.env` file** in your project root:

   ```env
   # MongoDB Atlas Connection String
   # Replace <username> and <password> with your actual credentials
   MONGODB_URI=mongodb+srv://habitflowai-user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   
   # Database name (will be created automatically if it doesn't exist)
   MONGODB_DB_NAME=habitflowai
   
   # Feature Flags
   USE_MONGO_PERSISTENCE=true
   VITE_USE_MONGO_PERSISTENCE=true
   
   # API Configuration
   VITE_API_BASE_URL=/api
   ```

2. **Replace placeholders:**
   - Replace `habitflowai-user` with your actual username
   - Replace `YOUR_PASSWORD` with your actual password (the one you saved in step 3)
   - The cluster URL (`cluster0.xxxxx.mongodb.net`) should already be in the connection string

   **Example:**
   ```env
   MONGODB_URI=mongodb+srv://myuser:mypassword123@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB_NAME=habitflowai
   USE_MONGO_PERSISTENCE=true
   VITE_USE_MONGO_PERSISTENCE=true
   ```

### 7. Test the Connection

Run your tests to verify the connection:

```bash
npm test
```

You should see:
```
Connecting to MongoDB: mongodb+srv://***@cluster0.xxxxx.mongodb.net/ (database: habitflowai_test)
Successfully connected to MongoDB database: habitflowai_test
```

## Troubleshooting

### Error: "Authentication failed"

**Causes:**
- Wrong username or password in connection string
- Special characters in password need to be URL-encoded

**Solution:**
- Double-check username and password
- If password has special characters (like `@`, `#`, `%`), URL-encode them:
  - `@` → `%40`
  - `#` → `%23`
  - `%` → `%25`
  - `&` → `%26`
  - etc.

### Error: "IP not whitelisted"

**Solution:**
- Go to Atlas → Network Access
- Add your current IP address (or use `0.0.0.0/0` for development)

### Error: "Connection timeout"

**Causes:**
- Network/firewall blocking connection
- Wrong connection string

**Solutions:**
- Verify connection string is correct
- Check if your network allows MongoDB connections
- Try from a different network

### Error: "MONGODB_URI environment variable is not set"

**Solution:**
- Make sure `.env` file exists in project root
- Verify `.env` file has `MONGODB_URI` set
- Restart your dev server/test runner after changing `.env`

## Security Best Practices

### For Development:
- ✅ Using `0.0.0.0/0` in Network Access is fine
- ✅ Storing credentials in `.env` is fine (make sure `.env` is in `.gitignore`)

### For Production:
- ❌ **Don't** use `0.0.0.0/0` - restrict to specific IPs
- ❌ **Don't** commit `.env` to git
- ✅ Use environment variables on your hosting platform
- ✅ Use a dedicated database user with minimal privileges
- ✅ Enable MongoDB Atlas encryption at rest

## Next Steps

Once connected:

1. ✅ Verify with `npm test`
2. ✅ Start dev server: `npm run dev`
3. ✅ Test creating categories in the app
4. ✅ View data in Atlas: Go to "Browse Collections" in Atlas dashboard

## Viewing Your Data in Atlas

1. Go to Atlas dashboard
2. Click **"Browse Collections"** on your cluster
3. Select database: `habitflowai` (or `habitflowai_test` for test data)
4. View collections: `categories`, etc.

This is helpful for debugging and understanding your data structure!

