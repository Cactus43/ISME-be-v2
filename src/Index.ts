import { Config } from './Config/Index';
import { Logger } from './Utils/Logger';
import { ConnectDatabase, Sequelize } from './Infra/Database';
import { app } from './App';


// ─── Bootstrap ─────────────────────────────────────────────────────────────

async function Main(): Promise<void> {
  try {
    Logger.info(`Starting ISME v2 [${Config.Env}]`);

    await ConnectDatabase();

    const server = app.listen(Config.Port, () => {
      Logger.info(`Server listening on port ${Config.Port}`);
    });

    // ─── Graceful Shutdown ───────────────────────────────────────────────
    const _shutdown = (signal: string) => {
      Logger.info(`Received ${signal}, shutting down gracefully...`);
      server.close(async () => {
        try {
          await Sequelize.close();
          Logger.info('Database connections closed');
        } catch { /* ignore */ }
        Logger.info('HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        Logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => _shutdown('SIGTERM'));
    process.on('SIGINT', () => _shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
      Logger.error({ err: reason }, 'Unhandled promise rejection');
    });

  } catch (err) {
    Logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

Main();
