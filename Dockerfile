FROM public.ecr.aws/lambda/nodejs:16
COPY index.js package.json  ${LAMBDA_TASK_ROOT}/
ENV bucket=${bucket}
ENV accessKeyId=${accessKeyId}
ENV secretAccessKey=${secretAccessKey}
RUN npm i
COPY . .
CMD [ "index.handler" ]  