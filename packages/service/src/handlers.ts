// The entry-point wrappers from @shop/util, with the service revision added to every result.
import * as util from '@shop/util';
import { serviceRevision } from './orders';

const extra = () => ({ serviceRevision });
type Options<T> = Omit<T, 'extra'>;

export const sqsWorker = <S extends Parameters<typeof util.sqsWorker>[0]['schema']>(o: Options<Parameters<typeof util.sqsWorker<S>>[0]>, fn: Parameters<typeof util.sqsWorker<S>>[1]) =>
  util.sqsWorker<S>({ ...o, extra }, fn);
export const scheduledJob = (o: Options<Parameters<typeof util.scheduledJob>[0]>, fn: Parameters<typeof util.scheduledJob>[1]) => util.scheduledJob({ ...o, extra }, fn);
export const apiHandler = <S extends Parameters<typeof util.apiHandler>[0]['schema']>(o: Options<Parameters<typeof util.apiHandler<S>>[0]>, fn: Parameters<typeof util.apiHandler<S>>[1]) =>
  util.apiHandler<S>({ ...o, extra }, fn);
