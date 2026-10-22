import type { ThemeEvent } from '@/config/themes';

/**
 * The event's name in its own metal: gold for Achievers Night, silver for the Arrowil Awards Ceremony.
 * `ready` false = theme not known yet: keep the space but hide the text, so the wrong name never flashes.
 */
export function EventTitle({
  event,
  ready = true,
  className = '',
}: {
  event: ThemeEvent;
  ready?: boolean;
  className?: string;
}) {
  const metal = event.titleStyle === 'silver' ? 'text-silver' : 'text-gold';
  return (
    <span className={`${metal} transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'} ${className}`}>
      {event.title}
    </span>
  );
}
