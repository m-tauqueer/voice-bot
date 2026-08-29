import { Calendar, ArrowUpRight, Bell } from "./icons";
import { Avatar, AvatarStack } from "./Avatar";

export const av = (n: number) => `https://i.pravatar.cc/120?img=${n}`;

export function ScheduleBar() {
  return (
    <header className="schedule">
      <button className="schedule__logo" aria-label="Home">
        <img src="/Logo-white.svg" alt="Target" width={44} height={44} />
      </button>

      <div className="schedule__bar">
        <span className="schedule__label">Your Schedule</span>
        <span className="schedule__date">
          <Calendar size={15} /> 28 March
        </span>

        <span className="schedule__spacer" />

        <div className="seg">
          <Avatar name="Ann" src={av(1)} size={22} />
          <span className="seg__time">36 min</span>
          <button className="seg__go" aria-label="open"><ArrowUpRight size={13} /></button>
        </div>

        <span className="tick">2:00 pm</span>

        <div className="seg seg--active">
          <span className="seg__tab">2:15 pm</span>
          <AvatarStack people={[{ name: "C", src: av(3) }, { name: "D", src: av(4) }]} size={22} />
          <span className="seg__fill" />
          <button className="seg__go seg__go--light" aria-label="open"><ArrowUpRight size={13} /></button>
        </div>

        <span className="tick">3:00 pm</span>

        <AvatarStack people={[{ name: "E", src: av(5) }, { name: "F", src: av(6) }]} size={22} />
        <button className="seg__go" aria-label="open"><ArrowUpRight size={13} /></button>
      </div>

      <div className="schedule__right">
        <button className="ibtn schedule__bell" aria-label="Notifications"><Bell size={19} /></button>
        <Avatar name="Evan V" src={av(8)} size={42} />
      </div>
    </header>
  );
}
