import { Card } from "../../components/ui/Card";
import { ACTIVITY } from "../data";

export function RecentActivity() {
  return (
    <Card variant="glass" className="mc-activity">
      {ACTIVITY.map((group) => (
        <div key={group.group} className="mc-activity__group">
          <div className="mc-activity__label">{group.group}</div>

          {group.items.map((item, index) => {
            const isLastOverall = group.group === "Yesterday" && index === group.items.length - 1;
            return (
              <div className="mc-activity__row" key={item.title}>
                <span className="mc-activity__rail">
                  <span className={"mc-activity__dot" + (item.hot ? " is-hot" : "")} />
                  {!isLastOverall && <span className="mc-activity__line" />}
                </span>
                <div className="mc-activity__main">
                  <div className="mc-activity__title">{item.title}</div>
                  <span className="mc-tag">{item.meta}</span>
                </div>
                <span className="mc-activity__time">{item.time}</span>
              </div>
            );
          })}
        </div>
      ))}
    </Card>
  );
}
