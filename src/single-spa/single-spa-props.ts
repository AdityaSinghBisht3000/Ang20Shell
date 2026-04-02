import { ReplaySubject } from 'rxjs';
import { AppProps } from 'single-spa';

export const singleSpaPropsSubject = new ReplaySubject<SingleSpaProps>(1);

export type SingleSpaProps = AppProps & {
  // Add any custom single-spa props here
};
