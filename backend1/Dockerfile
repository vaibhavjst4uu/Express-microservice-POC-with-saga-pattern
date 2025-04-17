# Use the official Node.js image as the base image
FROM node:20

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Copy wait-for-it.sh script
COPY wait-for-it.sh ./
RUN chmod +x wait-for-it.sh

# Run migrations and start the service
CMD ["sh", "-c", "./wait-for-it.sh mysql:3306 -t 30 -- npx sequelize-cli db:migrate && node orderService.js"]

# Expose the port the app runs on
EXPOSE 5001