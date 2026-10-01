import {
  ONBOARD_RADIUS_M,
  RIDE_CONFIRM_MOVE_M,
  RIDE_CONFIRM_RADIUS_M,
} from '../lib/geo';
import { metersLabel, type ConfirmSample } from '../lib/confirmRide';

function Gate({
  code,
  ok,
  label,
  detail,
}: {
  code: string;
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className={ok ? 'is-ok' : undefined}>
      <span className="confirm-debug-code">{code}</span>
      <span>
        <strong>{label}</strong>
        <em>{detail}</em>
      </span>
      <span className="confirm-debug-flag">{ok ? 'yes' : 'no'}</span>
    </li>
  );
}

export function ConfirmDebug({
  sample,
  retrying,
}: {
  sample: ConfirmSample;
  retrying: boolean;
}) {
  return (
    <div className="confirm-debug">
      <p className="confirm-debug-title">Check-in debug</p>
      <ul>
        <Gate
          code="A"
          ok={sample.a}
          label="Close enough to pick"
          detail={`${metersLabel(sample.pickM)} · need ≤ ${ONBOARD_RADIUS_M} m`}
        />
        <Gate
          code="B"
          ok={sample.b}
          label="Vehicle moved"
          detail={`${metersLabel(sample.vehicleMovedM)} · need ≥ ${RIDE_CONFIRM_MOVE_M} m`}
        />
        <Gate
          code="C"
          ok={sample.c}
          label="You moved"
          detail={`${metersLabel(sample.riderMovedM)} · need ≥ ${RIDE_CONFIRM_MOVE_M} m`}
        />
        <Gate
          code="D"
          ok={sample.d}
          label="Still together"
          detail={`${metersLabel(sample.separationM)} · need ≤ ${RIDE_CONFIRM_RADIUS_M} m`}
        />
      </ul>
      <p className="confirm-debug-result">
        {sample.pass
          ? 'All four true → pack'
          : retrying
            ? 'Retrying next GPS / vehicle ping'
            : 'Waiting'}
      </p>
    </div>
  );
}
