# LinkShrink - Backend
The backend of LinkShrink powers the URL shortening and analytics functionality. It includes JWT-based authentication, URL creation with expiration, analytics logging on redirects, and a secure REST API.

## Frontend Repository
The frontend for LinkShrink is available here: [LinkShrink Frontend](https://github.com/Preterno/LinkShrink-Frontend/)

## Features
- JWT-based authentication with hardcoded user
- Shorten links with optional custom alias and expiry
- RESTful API for:
  - Link creation
  - Listing all user links
  - Deletion of links
  - Click analytics per link
- Asynchronous analytics logging (IP, timestamp, device, browser, referrer)
- MongoDB-based persistent storage

## Technologies and Libraries
- **Node.js & Express.js** – Backend runtime and framework for handling API logic.
- **MongoDB & Mongoose** – NoSQL database with schema modeling and validation.
- **JSON Web Token (JWT)** – For user authentication and session management.
- **Bcrypt.js** – To securely hash and compare passwords.
- **NanoID** – For generating unique, URL-safe short codes.
- **Express-Useragent & Request-IP** – For capturing device and location metadata.
- **CORS & dotenv** – Middleware for cross-origin requests and managing environment configs.

## Installation and Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Preterno/LinkShrink-Backend.git
   cd LinkShrink-Backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the directory and configure:
   ```ini
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/linkshrink
   JWT_SECRET=your_jwt_secret
   EMAIL=your_email_address
   PASSWORD=hashed_bcrypt_password
   ```
   Note:
   * Use a bcrypt hash (10 salt rounds) for the PASSWORD field. You can generate it at [bcrypt-generator.com](https://bcrypt-generator.com/).

4. Start the backend server:
   ```bash
   node server.js
   ```

5. The server will run at `http://localhost:3000`

## API Endpoints
* `POST /api/login` – Login and receive JWT
* `POST /api/verifyToken` – Verify JWT validity
* `POST /api/links` – Create a new shortened link
* `GET /api/links` – Get all links of authenticated user
* `DELETE /api/links/:id` – Delete a link
* `GET /:shortCode` – Redirect and log click
* `GET /api/links/:id/analytics` – Get click analytics for a link

## Connect with Me
Feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/aslam8483).