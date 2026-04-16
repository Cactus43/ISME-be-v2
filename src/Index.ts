import { Config } from './Config/Index';
import { Logger } from './Utils/Logger';
import { ConnectDatabase, Sequelize } from './Infra/Database';
import { BuildApp } from './App';
import { Container } from './Infra/Container';
import { WeeklyJob } from './Infra/WeeklyJob';


// ─── Bootstrap ─────────────────────────────────────────────────────────────

async function Main(): Promise<void> {
  try {
    Logger.info(`Starting ISME v2 [${Config.Env}]`);

    await ConnectDatabase();
    await Container.InterventionAdapter.EnsurePriorityTrackingSchema();
    const app = await BuildApp();

    const address = await app.listen({ port: Config.Port, host: '0.0.0.0' });
    Logger.info(`Server listening on ${address}`);

    // ─── Weekly Job ──────────────────────────────────────────────────────
    const job = new WeeklyJob(Container.InterventionAdapter, Logger);
    job.Start();

    // ─── Graceful Shutdown ───────────────────────────────────────────────
    const _shutdown = async (signal: string) => {
      Logger.info(`Received ${signal}, shutting down gracefully...`);
      job.Stop();

      try {
        await app.close();
        Logger.info('HTTP server closed');
      } catch (err) {
        Logger.error({ err }, 'Failed to close HTTP server cleanly');
      }

      try {
        await Sequelize.close();
        Logger.info('Database connections closed');
      } catch {
        // ignore
      }

      process.exit(0);
    };

    process.on('SIGTERM', () => void _shutdown('SIGTERM'));
    process.on('SIGINT', () => void _shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
      Logger.error({ err: reason }, 'Unhandled promise rejection');
    });

  } catch (err) {
    Logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

Main();
