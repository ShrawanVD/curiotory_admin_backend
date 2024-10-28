# Use Node.js version 14 as the base image
FROM node:18

# Update Ubuntu's package list
RUN apt-get update

# Set the working directory inside the container
WORKDIR /usr/src/app
# EXPOSE 3100

# Copy package.json and package-lock.json to WORKDIR
COPY package*.json ./

# Install dependencies`
RUN npm install

# Copy all files from current directory to WORKDIR
COPY . .

# Command to run the application
CMD ["node", "index.js"]