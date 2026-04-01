
import { UserAdapter } from '../Adapters/UserAdapter';
import { TokenAdapter } from '../Adapters/TokenAdapter';
import { DeviceAdapter } from '../Adapters/DeviceAdapter';
import { InterventionAdapter } from '../Adapters/InterventionAdapter';
import { MediaAdapter } from '../Adapters/MediaAdapter';
import { TeamAdapter } from '../Adapters/TeamAdapter';
import { AuthOperations } from '../Operations/AuthOperations';
import { OperatorOperations } from '../Operations/OperatorOperations';
import { InterventionOperations } from '../Operations/InterventionOperations';
import { MediaOperations } from '../Operations/MediaOperations';
import { TeamOperations } from '../Operations/TeamOperations';
import { AuthController } from '../Controllers/AuthController';
import { InterventionController } from '../Controllers/InterventionController';
import { OperatorController } from '../Controllers/OperatorController';
import { MediaController } from '../Controllers/MediaController';
import { TeamController } from '../Controllers/TeamController';
import { EventBus } from './EventBus';
import { AuditSubscriber } from './AuditSubscriber';
import { Logger } from '../Utils/Logger';
import {
  DEFAULT_AUTH_POLICY,
  DEFAULT_INTERVENTION_POLICY,
} from '../Data/Types/Policies';


/* ──────────────────────────────────────────────────────────────────
   Composition root — wires adapters → operations → controllers.
   Exported as a singleton consumed by App.ts.
   ────────────────────────────────────────────────────────────────── */

function Build() {

  const Log = Logger;

  // ── Event bus ──
  const Bus = new EventBus();

  // ── Audit subscriber (listens to domain events) ──
  new AuditSubscriber(Bus, Log);

  // ── Adapters ──
  const UserAdapterInstance    = new UserAdapter();
  const TokenAdapterInstance   = new TokenAdapter();
  const DeviceAdapterInstance  = new DeviceAdapter();
  const InterventionAdapterInstance = new InterventionAdapter();
  const MediaAdapterInstance   = new MediaAdapter();
  const TeamAdapterInstance    = new TeamAdapter();

  // ── Operations ──
  const AuthOps = new AuthOperations({
    UserAdapter: UserAdapterInstance,
    TokenAdapter: TokenAdapterInstance,
    DeviceAdapter: DeviceAdapterInstance,
    Logger: Log.child({ module: 'AuthOperations' }),
    EventBus: Bus,
    Policy: DEFAULT_AUTH_POLICY,
  });

  const OperatorOps = new OperatorOperations({
    UserAdapter: UserAdapterInstance,
    Logger: Log.child({ module: 'OperatorOperations' }),
    EventBus: Bus,
  });

  const InterventionOps = new InterventionOperations({
    InterventionAdapter: InterventionAdapterInstance,
    MediaAdapter: MediaAdapterInstance,
    Logger: Log.child({ module: 'InterventionOperations' }),
    EventBus: Bus,
    Policy: DEFAULT_INTERVENTION_POLICY,
  });

  const MediaOps = new MediaOperations({
    MediaAdapter: MediaAdapterInstance,
    Logger: Log.child({ module: 'MediaOperations' }),
    EventBus: Bus,
  });

  const TeamOps = new TeamOperations({
    TeamAdapter: TeamAdapterInstance,
    Logger: Log.child({ module: 'TeamOperations' }),
    EventBus: Bus,
  });

  // ── Controllers ──
  const AuthCtrl        = new AuthController({ AuthOperations: AuthOps });
  const InterventionCtrl = new InterventionController({ InterventionOperations: InterventionOps, TeamAdapter: TeamAdapterInstance });
  const OperatorCtrl    = new OperatorController({ OperatorOperations: OperatorOps });
  const MediaCtrl       = new MediaController({ MediaOperations: MediaOps });
  const TeamCtrl        = new TeamController({ TeamOperations: TeamOps });

  return {
    Bus,
    AuthController: AuthCtrl,
    InterventionController: InterventionCtrl,
    OperatorController: OperatorCtrl,
    MediaController: MediaCtrl,
    TeamController: TeamCtrl,
  };
}

export const Container = Build();
