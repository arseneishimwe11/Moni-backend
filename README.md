# Moni Backend

<p align="center">
  <a href="https://nx.dev" target="_blank" rel="noreferrer">
    <img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="220" alt="Nx Logo" />
  </a>
  <a href="http://nestjs.com/" target="blank">
    <img src="https://nestjs.com/img/logo_text.svg" width="320" alt="NestJS Logo" />
  </a>
</p>

✨ Your new, shiny [Nx workspace](https://nx.dev) is almost ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/node?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

---

## Technologies Used

This project uses the following technologies:

### 1. **NestJS**
   - [NestJS](https://nestjs.com/) is a framework for building efficient, scalable Node.js server-side applications. It is heavily inspired by Angular, bringing an excellent structure and easy testing.

### 2. **Nx**
   - [Nx](https://nx.dev/) is a powerful set of extensible dev tools for monorepos. It provides advanced capabilities like code generation, dependency graph, and more. Nx helps in managing complex workflows with multiple applications and libraries.

### 3. **Node.js**
   - The backend is built on [Node.js](https://nodejs.org/), a JavaScript runtime built on Chrome's V8 JavaScript engine. It's used for building scalable network applications.

### 4. **TypeScript**
   - [TypeScript](https://www.typescriptlang.org/) is a statically typed superset of JavaScript. It adds type safety and powerful development features to the JavaScript ecosystem.

### 5. **Docker (Optional)**
   - [Docker](https://www.docker.com/) can be used for containerization of the backend application, allowing consistent environments and easier deployment.

---

## Run the Application

To run the development server for your app, use the following command:

```sh
npx nx serve Moni-Backend
```

## Build the Production Bundle

To create a production bundle, run:

```sh
npx nx build Moni-Backend
```

## View Available Targets

To see all available targets to run for a project, use:

```bash
npx nx show project Moni-Backend
```

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
