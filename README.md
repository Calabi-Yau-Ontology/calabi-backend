<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

```
calabi-backend/
├── src
│   ├── main.ts
│   ├── app.module.ts
│   ├── config
│   │   ├── configuration.ts
│   │   └── validation.ts
│   ├── common
│   │   ├── filters
│   │   │   └── http-exception.filter.ts
│   │   └── interceptors
│   │       └── transform.interceptor.ts
│   ├── database
│   │   ├── database.module.ts
│   │   └── ormconfig.ts
│   ├── neo4j
│   │   ├── neo4j.module.ts
│   │   └── neo4j.service.ts
│   ├── users
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── dto
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   └── entities
│   │       └── user.entity.ts
│   ├── auth
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto
│   │   │   ├── login.dto.ts
│   │   │   └── register.dto.ts
│   │   └── strategies
│   │       ├── jwt.strategy.ts
│   │       └── local.strategy.ts
│   ├── events
│   │   ├── events.module.ts
│   │   ├── events.controller.ts
│   │   ├── events.service.ts
│   │   ├── dto
│   │   │   ├── create-event.dto.ts
│   │   │   └── update-event.dto.ts
│   │   └── entities
│   │       └── event.entity.ts
│   ├── suggestions
│   │   ├── suggestions.module.ts
│   │   ├── suggestions.controller.ts
│   │   ├── suggestions.service.ts
│   │   └── dto
│   │       └── suggest.dto.ts
│   └── ontology
│       ├── ontology.module.ts
│       ├── ontology.service.ts
│       └── dto
│           └── create-node.dto.ts
├── package.json
├── tsconfig.json
├── .env
└── README.md
```

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
