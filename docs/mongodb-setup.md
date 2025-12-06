# MongoDB Setup Guide

This guide explains how to set up MongoDB for local development and testing.

## Quick Start

### Option 1: Install MongoDB Locally (Recommended for Development)

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

### Option 2: Use MongoDB Atlas (Cloud - No Local Installation)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a free cluster (M0 tier)
4. Get your connection string from the Atlas dashboard
5. Use the connection string in your `.env` file (see below)

### Option 3: Use Docker (If you have Docker installed)

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

## Environment Configuration

### 1. Create `.env` file

Create a `.env` file in the project root (copy from `.env.example` if it exists):

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=habitflowai

# Feature Flags
USE_MONGO_PERSISTENCE=true
VITE_USE_MONGO_PERSISTENCE=true

# API Configuration (if needed)
VITE_API_BASE_URL=/api
```

### 2. For MongoDB Atlas (Cloud)

If using MongoDB Atlas, your `.env` will look like:

```env
# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/
MONGODB_DB_NAME=habitflowai

USE_MONGO_PERSISTENCE=true
VITE_USE_MONGO_PERSISTENCE=true
```

**Important:** Replace `username`, `password`, and `cluster0.xxxxx` with your actual Atlas credentials.

### 3. For MongoDB with Authentication (Local)

If you've set up authentication on your local MongoDB:

```env
MONGODB_URI=mongodb://username:password@localhost:27017
MONGODB_DB_NAME=habitflowai
```

## Verify MongoDB Connection

### Test Connection from Command Line

```bash
# Connect to MongoDB
mongosh

# Or with connection string
mongosh mongodb://localhost:27017

# Once connected, try:
show dbs
# Should list databases including 'habitflowai' (once you've used it)

# Exit
exit
```

### Test Connection from Application

Run the tests to verify connection:

```bash
npm test
```

If MongoDB is properly configured, you should see:
```
Connecting to MongoDB: mongodb://localhost:27017 (database: habitflowai_test)
Successfully connected to MongoDB database: habitflowai_test
```

## Troubleshooting

### Error: "MONGODB_URI environment variable is not set"

**Solution:** Make sure you have a `.env` file in the project root with `MONGODB_URI` set.

### Error: "MongoDB connection failed"

**Possible causes:**
1. **MongoDB is not running**
   - macOS: `brew services list` (check if mongodb-community is started)
   - Linux: `sudo systemctl status mongod`
   - Windows: Check Services app for MongoDB service

2. **Wrong connection string**
   - Verify `MONGODB_URI` in `.env` matches your MongoDB setup
   - For local: `mongodb://localhost:27017`
   - For Atlas: `mongodb+srv://...`

3. **Firewall blocking connection**
   - Ensure port 27017 is not blocked
   - For Atlas: Check IP whitelist in Atlas dashboard

### Error: "Connection timeout"

**Solutions:**
- Check if MongoDB is actually running
- Verify the connection string is correct
- For Atlas: Check network connectivity and IP whitelist

### Tests Fail with "expected X but got Y"

**Solution:** This is usually a test isolation issue. The tests should clean up data between runs, but if you see persistent failures:

1. **Manually clean test database:**
   ```bash
   mongosh
   use habitflowai_test
   db.categories.deleteMany({})
   exit
   ```

2. **Or drop and recreate test database:**
   ```bash
   mongosh
   use habitflowai_test
   db.dropDatabase()
   exit
   ```

## Development vs Test Databases

The application uses different databases for development and testing:

- **Development:** `habitflowai` (from `MONGODB_DB_NAME`)
- **Testing:** `habitflowai_test` (automatically used by tests)

Tests automatically use the test database and clean up after themselves.

## Next Steps

Once MongoDB is set up:

1. ✅ Verify connection with `npm test`
2. ✅ Start your development server: `npm run dev`
3. ✅ Test the application with `VITE_USE_MONGO_PERSISTENCE=true`
4. ✅ Check MongoDB Compass (optional GUI tool) to view your data

## MongoDB Compass (Optional GUI Tool)

MongoDB Compass is a visual tool for exploring your MongoDB data:

1. Download from: https://www.mongodb.com/try/download/compass
2. Connect using: `mongodb://localhost:27017`
3. Browse databases and collections visually

This is helpful for debugging and understanding your data structure.

