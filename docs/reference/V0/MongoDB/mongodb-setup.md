# MongoDB Setup Guide

Complete guide for setting up MongoDB for HabitFlowAI, including local installation and MongoDB Atlas (cloud).

## Quick Start

### Option 1: MongoDB Atlas (Recommended - No Installation)

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for a free account
3. Create a free cluster (M0 tier)
4. Follow the [Atlas Setup Steps](#mongodb-atlas-setup) below

### Option 2: Install MongoDB Locally

#### macOS (using Homebrew)

```bash
# Install MongoDB Community Edition
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Verify it's running
mongosh
# If connection succeeds, type 'exit' to leave
```

#### Linux (Ubuntu/Debian)

```bash
# Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update package list and install
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify it's running
mongosh
```

#### Windows

1. Download MongoDB Community Edition from: https://www.mongodb.com/try/download/community
2. Run the installer (choose "Complete" installation)
3. MongoDB will install as a Windows service and start automatically
4. Verify by opening Command Prompt and running:
   ```cmd
   mongosh
   ```

### Option 3: Use Docker

```bash
# Run MongoDB in a Docker container
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_DATABASE=habitflowai \
  mongo:latest

# Verify it's running
docker ps
# Should see mongodb container running

# Connect to verify
mongosh mongodb://localhost:27017
```

## MongoDB Atlas Setup

### Step 1: Create Account and Cluster

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for a free account (or log in)
3. Click **"Build a Database"** or **"Create"** → **"Database"**
4. Choose **"M0 Free"** tier (Free Forever)
5. Select a cloud provider and region (choose closest to you)
6. Name your cluster (e.g., "HabitFlowAI")
7. Click **"Create"** (takes 3-5 minutes)

### Step 2: Create Database User

1. Go to **"Database Access"** (left sidebar)
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Enter a username (e.g., `habitflowai-user`)
5. Click **"Autogenerate Secure Password"** (save this password!)
6. Under "Database User Privileges", select **"Read and write to any database"**
7. Click **"Add User"**

**⚠️ IMPORTANT:** Save your username and password - you'll need them for the connection string!

### Step 3: Configure Network Access

1. Go to **"Network Access"** (left sidebar)
2. Click **"Add IP Address"**
3. For development, click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
   - **Note:** For production, restrict to specific IPs
4. Click **"Confirm"**

### Step 4: Get Connection String

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

## Environment Configuration

### Create `.env` File

Create a `.env` file in the project root:

**For MongoDB Atlas:**
```env
# MongoDB Atlas Connection String
# Replace <username> and <password> with your actual credentials
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority

# Database name (will be created automatically if it doesn't exist)
MONGODB_DB_NAME=habitflowai

# Feature Flags
USE_MONGO_PERSISTENCE=true
VITE_USE_MONGO_PERSISTENCE=true

# API Configuration
VITE_API_BASE_URL=/api
```

**For Local MongoDB:**
```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=habitflowai

# Feature Flags
USE_MONGO_PERSISTENCE=true
VITE_USE_MONGO_PERSISTENCE=true

# API Configuration
VITE_API_BASE_URL=/api
```

**Important:** 
- Replace `username`, `password`, and `cluster0.xxxxx` with your actual Atlas credentials
- If password has special characters, URL-encode them (`@` → `%40`, `#` → `%23`, etc.)

## Verify Connection

### Test via Backend Server

Start the backend server:

```bash
npm run dev:server
```

You should see:
```
🚀 Server running on http://localhost:3000
💾 MongoDB persistence: ENABLED
Connecting to MongoDB: mongodb+srv://***@...
Successfully connected to MongoDB database: habitflowai
```

If you see "Successfully connected", your MongoDB setup is working!

### Test via Command Line

**For Local MongoDB:**
```bash
mongosh
use habitflowai
show collections
```

**For MongoDB Atlas:**
```bash
mongosh "mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/"
use habitflowai
show collections
```

### Test via Application

Run tests to verify:

```bash
npm test
```

You should see:
```
Connecting to MongoDB: ... (database: habitflowai_test)
Successfully connected to MongoDB database: habitflowai_test
```

## View Data in MongoDB Atlas

You don't need MongoDB Compass - you can view data directly in Atlas:

1. Go to https://cloud.mongodb.com
2. Click your **cluster**
3. Click **"Browse Collections"** button
4. Click **`habitflowai`** database
5. Click **`categories`** collection
6. View your data!

## Troubleshooting

### Error: "MONGODB_URI environment variable is not set"

**Solution:** Make sure you have a `.env` file in the project root with `MONGODB_URI` set.

### Error: "MongoDB connection failed"

**Possible causes:**
1. **MongoDB is not running** (for local)
   - macOS: `brew services list`
   - Linux: `sudo systemctl status mongod`
   - Windows: Check Services app

2. **Wrong connection string**
   - Verify `MONGODB_URI` in `.env` matches your setup
   - For local: `mongodb://localhost:27017`
   - For Atlas: `mongodb+srv://...`

3. **Network access not configured** (for Atlas)
   - Go to Atlas → Network Access
   - Add your IP or use `0.0.0.0/0` for development

### Error: "Authentication failed" (Atlas)

**Causes:**
- Wrong username or password
- Special characters in password need URL-encoding

**Solution:**
- Double-check credentials
- URL-encode special characters: `@` → `%40`, `#` → `%23`, `%` → `%25`

### Error: "Connection timeout"

**Solutions:**
- Check if MongoDB is running (for local)
- Verify connection string is correct
- For Atlas: Check network connectivity and IP whitelist

## Development vs Test Databases

- **Development:** `habitflowai` (from `MONGODB_DB_NAME`)
- **Testing:** `habitflowai_test` (automatically used by tests)

Tests automatically use the test database and clean up after themselves.

## Security Best Practices

### For Development:
- ✅ Using `0.0.0.0/0` in Network Access is fine
- ✅ Storing credentials in `.env` is fine (make sure `.env` is in `.gitignore`)

### For Production:
- ❌ **Don't** use `0.0.0.0/0` - restrict to specific IPs
- ❌ **Don't** commit `.env` to git
- ✅ Use environment variables on your hosting platform
- ✅ Use a dedicated database user with minimal privileges

## Next Steps

Once MongoDB is set up:

1. ✅ Verify connection (see above)
2. ✅ Start development servers (see `docs/mongodb-verification.md`)
3. ✅ Test creating categories in the app
4. ✅ View data in Atlas dashboard
