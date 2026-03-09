########################################
# Frontend Docker image (React SPA)    #
# - Builds production bundle           #
# - Serves via simple Node dev server  #
########################################

FROM node:20-slim AS frontend

WORKDIR /app

# Install app dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Expose default React dev port
EXPOSE 3000

# Default command: start the React development server
# In production you can switch this to "npm run build" and serve with Nginx.
CMD ["npm", "start"]

