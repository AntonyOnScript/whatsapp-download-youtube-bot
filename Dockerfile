FROM public.ecr.aws/lambda/nodejs:16
COPY app.js package.json  ${LAMBDA_TASK_ROOT}/
ENV bucket=${bucket}
ENV accessKeyId=${accessKeyId}
ENV secretAccessKey=${secretAccessKey}
RUN npm i
COPY . .
CMD [ "app.handler" ]  