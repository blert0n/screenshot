# Use the official Node.js image as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available) to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install && \
    npx playwright install && \
    npx playwright install-deps
    
# Copy the rest of the application code to the working directory
COPY . .

# Expose the port your app runs on
EXPOSE 9090

# Start the app
CMD ["npm", "start"]
