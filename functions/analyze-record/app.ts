import { SQSHandler, SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { BatchProcessor, EventType, processPartialResponse } from '@aws-lambda-powertools/batch';
import { SendTaskSuccessCommand, SFNClient } from '@aws-sdk/client-sfn';

const logger = new Logger();
const sfnClient = new SFNClient();
const processor = new BatchProcessor(EventType.SQS);

type Item = {
    id: string;
    numberValue: number;
};

type MessageBody = {
    items: {
        Items: Item[];
    };
    taskToken: string;
};

const getRandomInt = (max: number, min?: number) => {
    if (!min) {
        min = 0;
    }
    return Math.max(min, Math.floor(Math.random() * max));
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const processItem = async (item: Item): Promise<void> => {
    logger.info(`item start: ${item.id} - ${item.numberValue}`);
    const sleepPeriod = getRandomInt(5000);

    // enable lines below to try a failure scenario
    // if (sleepPeriod <= 2000) {
    //     throw new Error('Sleep Period is too short!');
    // }

    logger.info(`sleeping for item ${item.id}: ${sleepPeriod} milliseconds`);
    await sleep(sleepPeriod);
    logger.info(`item end: ${item.id} - ${item.numberValue}`);
};

const recordHandler = async (record: SQSRecord): Promise<void> => {
    logger.info(JSON.stringify(record));
    const body = JSON.parse(record.body) as MessageBody;
    // there should be 2+ items only if they make up the unit of work
    const promises = body.items.Items.map((item) => {
        return processItem(item); // unit of work
    });
    await Promise.all(promises);
    const cmd = new SendTaskSuccessCommand({
        output: JSON.stringify(body.items.Items),
        taskToken: body.taskToken,
    });
    await sfnClient.send(cmd); // send success signal
};

export const lambdaHandler: SQSHandler = async (event: SQSEvent, context: Context): Promise<void> => {
    logger.appendKeys({
        awsRequestId: context.awsRequestId,
    });
    await processPartialResponse(event, recordHandler, processor, {
        context,
    });
};
