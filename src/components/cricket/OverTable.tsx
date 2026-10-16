import { Over, Ball } from '@/lib/cricketTypes';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface OverTableProps {
  overs: Over[];
  className?: string;
}

export function OverTable({ overs, className }: OverTableProps) {
  const [isOpen, setIsOpen] = useState(true);

  const getBallDisplay = (ball: Ball) => {
    if (ball.isWicket) return 'W';
    if (ball.isWide) return `${ball.runs}Wd`;
    if (ball.isNoBall) return `${ball.runs}Nb`;
    return ball.runs.toString();
  };

  const getBallClass = (ball: Ball) => {
    if (ball.isWicket) return 'text-destructive font-bold';
    if (ball.runs === 4) return 'text-cricket-four font-bold';
    if (ball.runs === 6) return 'text-cricket-six font-bold';
    if (ball.runs < 0) return 'text-destructive';
    return '';
  };

  const getOverTotal = (over: Over) => {
    return over.balls.reduce((sum, ball) => sum + ball.runs, 0);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-2.5 md:p-3 bg-card hover:bg-accent rounded-t-lg transition-colors">
        <ChevronDown className={cn('w-4 h-4 md:w-5 md:h-5 transition-transform', isOpen && 'rotate-180')} />
        <span className="font-semibold text-sm md:text-base">Over-by-Over Breakdown</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-t-0 rounded-b-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12 md:w-20 text-xs md:text-sm">Over</TableHead>
                  <TableHead className="text-xs md:text-sm">Ball by Ball</TableHead>
                  <TableHead className="w-12 md:w-20 text-right text-xs md:text-sm">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overs.map((over, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-xs md:text-sm">{over.number}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 md:gap-2 flex-wrap">
                        {over.balls.map((ball, ballIndex) => (
                          <span
                            key={ball.id}
                            className={cn(
                              'inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-full bg-muted text-xs md:text-sm',
                              getBallClass(ball)
                            )}
                          >
                            {getBallDisplay(ball)}
                          </span>
                        ))}
                        {over.balls.length === 0 && (
                          <span className="text-muted-foreground text-xs md:text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs md:text-sm">
                      {getOverTotal(over)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
