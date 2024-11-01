import { Handler, Context } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { v4 as uuid } from 'uuid';
import * as s3 from '@aws-sdk/client-s3';

interface LambdaEvent {
    scheduledEventTime: string;
}

const s3BucketName = process.env.S3_BUCKET_NAME;

const logger = new Logger();

const s3Client = new s3.S3Client({
    region: process.env.AWS_REGION,
});

const getRandomInt = (max: number, min?: number) => {
    if (!min) {
        min = 0;
    }
    return Math.max(min, Math.floor(Math.random() * max));
};

const generateBody = () => {
    const items = [];
    const itemsSize = getRandomInt(10) + 1;
    for (let index = 0; index < itemsSize; index++) {
        items.push({
            id: uuid(),
            numberValue: getRandomInt(10000),
        });
    }
    return items;
};

type Response = {
    dateTime: string;
    s3: {
        bucketName: string;
        bucketKey: string;
    };
};

export const lambdaHandler: Handler = async (event: LambdaEvent, context: Context): Promise<Response> => {
    logger.info('Lambda invocation event', { event });

    logger.appendKeys({
        awsRequestId: context.awsRequestId,
    });

    if (!s3BucketName) {
        throw new Error('S3_BUCKET_NAME is not defined!');
    }

    const scheduledEventTime = new Date(event.scheduledEventTime);

    if (!scheduledEventTime) {
        throw new Error('scheduledEventTime is missing!');
    }

    const s3ObjectKey = `${scheduledEventTime.getTime()}.json`;

    const input: s3.PutObjectCommandInput = {
        Body: JSON.stringify(generateBody()),
        Bucket: s3BucketName,
        Key: s3ObjectKey,
        ContentType: "'application/json'",
    };
    const command = new s3.PutObjectCommand(input);
    await s3Client.send(command);

    return {
        dateTime: event.scheduledEventTime,
        s3: {
            bucketName: s3BucketName,
            bucketKey: s3ObjectKey,
        },
    };
};
